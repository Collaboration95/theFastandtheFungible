# syntax=docker/dockerfile:1.7
FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npx vite build && node docker/bundle.mjs out

FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runtime
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=build /src/out/ dist/
COPY --from=build /src/node_modules/playwright-core node_modules/playwright-core
COPY data/ data/
COPY docker/hosted/ docker/hosted/
COPY scripts/hosted-control.mjs scripts/hosted-control.mjs
ENV NODE_ENV=production HOSTED=1 PUBLISHER_FAULTS=0
USER 1000:1000
ENTRYPOINT ["/sbin/tini", "--", "node", "/app/docker/hosted/start.mjs"]
FROM runtime AS api
ENV ROLE=api PORT=8788 RAW_API_PORT=18788 HOST=127.0.0.1 APP_DB=/state/api/app.db REPORT_DIR=/state/api/reports HOSTED_CONTROL_PATH=/state/control.json
EXPOSE 8788
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s CMD node /app/docker/hosted/health.mjs
FROM runtime AS publisher
ENV ROLE=publisher PUBLISHER_PORT=8790
WORKDIR /state/publisher
EXPOSE 8790
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s CMD node /app/docker/hosted/health.mjs
FROM nginxinc/nginx-unprivileged:1.29.8-alpine3.23-slim@sha256:59678856b05324b7f6371f26eb1520be7fcd8bdc8ab380fc4913db8503e5a842 AS web
USER root
RUN apk add --no-cache tini
COPY docker/hosted/nginx.conf /etc/nginx/nginx.conf
COPY docker/hosted/proxy-headers.conf /etc/nginx/proxy-headers.conf
COPY docker/hosted/paused.html /usr/share/nginx/html/paused.html
COPY --from=build /src/dist/ /usr/share/nginx/html/
USER 101:101
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["nginx", "-g", "daemon off;"]
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1:8080/livez || exit 1
