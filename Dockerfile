# Whole app for Cloud Run (web + API + publisher in one container). See scripts/deploy-cloudrun.sh.
# Node 24 includes node:sqlite. Chromium is only for the PDF report; HTML is the fallback.
FROM node:24-bookworm-slim
WORKDIR /app
ENV HUSKY=0 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package.json package-lock.json ./
RUN npm ci && npx playwright install --with-deps chromium && rm -rf /root/.npm
COPY index.html tsconfig*.json vite.config.ts ./
COPY src/ ./src/
COPY server/ ./server/
COPY publisher/ ./publisher/
COPY shared/ ./shared/
COPY data/corpus/ ./data/corpus/
COPY scripts/cloudrun.mjs ./scripts/
RUN npx vite build && mkdir -p data/reports && chown -R node:node data
ENV NODE_ENV=production PORT=8080
USER node
EXPOSE 8080
CMD ["node", "--import", "tsx", "scripts/cloudrun.mjs"]
