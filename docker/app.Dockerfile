# syntax=docker/dockerfile:1.7
# One Dockerfile, three targets: web, api, publisher. Build with scripts/docker-build.sh,
# which feeds a clean `git archive` of one commit as the context (no .env, no node_modules).
ARG NODE_IMAGE=node:24.21.0-alpine3.24
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29.8-alpine3.23-slim
ARG ALPINE_IMAGE=alpine:3.24.2
FROM ${NODE_IMAGE} AS node

FROM ${NODE_IMAGE} AS build
WORKDIR /src
COPY package.json package-lock.json ./
# --ignore-scripts skips husky and protobufjs; esbuild's binary comes from its optional
# per-platform package, so nothing here needs an install script.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
# vite build only: lint and typecheck are the merge gate's job (npm run check:fast).
RUN npx vite build && node docker/bundle.mjs out

# Static UI plus a reverse proxy for /runs and /api (SSE unbuffered). Non-root, port 8080.
FROM ${NGINX_IMAGE} AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1

# Runtime: plain Alpine plus the node binary (same musl/Alpine release as NODE_IMAGE),
# without npm, corepack and yarn (about 24 MB the bundles never use).
FROM ${ALPINE_IMAGE} AS node-runtime
RUN apk add --no-cache libstdc++ tini && adduser -D -u 1000 node
COPY --from=node /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production
ENTRYPOINT ["/sbin/tini", "--"]

FROM node-runtime AS publisher
WORKDIR /app
# data/ holds the corpus and the writer roster (data/writers/).
COPY data/ data/
COPY --from=build /src/out/publisher.mjs dist/
# The journal path is cwd-relative (data/publisher.db), so run from the state directory.
RUN mkdir -p /var/lib/publisher/data && chown -R node:node /var/lib/publisher
WORKDIR /var/lib/publisher
USER node
ENV PUBLISHER_PORT=8790
EXPOSE 8790
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PUBLISHER_PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "/app/dist/publisher.mjs"]

# Alpine's Chromium (musl) renders the PDF report; Playwright's bundled build needs glibc.
FROM node-runtime AS api
RUN apk add --no-cache chromium
WORKDIR /app
COPY --from=build /src/node_modules/playwright-core node_modules/playwright-core
COPY --from=build /src/out/api.mjs dist/
RUN mkdir -p /var/lib/researchagent/reports && chown -R node:node /var/lib/researchagent
USER node
ENV CHROMIUM_PATH=/usr/bin/chromium HOST=0.0.0.0 PORT=8788 \
    APP_DB=/var/lib/researchagent/app.db REPORT_DIR=/var/lib/researchagent/reports
EXPOSE 8788
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/api.mjs"]
