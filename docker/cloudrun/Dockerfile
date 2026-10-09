# Cloud Run: web (nginx) + API + publisher in one container (`make cloudrun`). Same build stage as
# docker/app.Dockerfile (vite build + esbuild bundles); the runtime combines its web, api and publisher targets.
# scripts/cloudrun-deploy.sh copies this file and Dockerfile.dockerignore to the root of a `git archive`.
FROM node:24.21.0-alpine3.24 AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npx vite build && node docker/bundle.mjs out

FROM node:24.21.0-alpine3.24
# Alpine's Chromium renders the PDF report (Playwright's bundled build needs glibc); a failed launch falls back to HTML.
RUN apk add --no-cache chromium nginx tini
WORKDIR /app
# data/ holds the corpus, writer roster and calibration; the API reads data/calibration cwd-relative,
# the publisher reads ../data from dist/. Ledgers (data/*.db) start fresh on each instance.
COPY data/ data/
COPY --from=build /src/node_modules/playwright-core node_modules/playwright-core
COPY --from=build /src/out/ dist/
COPY --from=build /src/dist/ web/
COPY scripts/cf-probe.mjs scripts/stage-checks.mjs scripts/
COPY docker/cloudrun/ docker/cloudrun/
ENV NODE_ENV=production CHROMIUM_PATH=/usr/bin/chromium PUBLISHER_FAULTS=0
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "docker/cloudrun/start.mjs"]
