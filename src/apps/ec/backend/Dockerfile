# Build context is repo root (docker-compose sets context: .)

# ── deps ──────────────────────────────────────────────────────
FROM node:24-slim AS deps
WORKDIR /app

# npm workspaces requires all workspace package.json files present
COPY package.json package-lock.json ./
COPY src/apps/ec/backend/package.json       ./src/apps/ec/backend/
COPY src/apps/backoffice/backend/package.json ./src/apps/backoffice/backend/
COPY src/apps/backoffice/frontend/package.json ./src/apps/backoffice/frontend/
RUN npm ci

# ── dev (local): source is volume-mounted via docker-compose ──
FROM deps AS dev
EXPOSE 3000
CMD ["npm", "run", "dev:ec"]

# ── prod: source baked into image ─────────────────────────────
FROM deps AS prod
COPY --chown=node:node tsconfig.base.json tsconfig.json ./
COPY --chown=node:node src ./src
EXPOSE 3000
USER node
CMD ["npm", "run", "start:ec"]