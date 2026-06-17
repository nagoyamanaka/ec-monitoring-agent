# Build context is repo root (same as ec-backend Dockerfile)
FROM node:24-slim

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app

# pnpm workspace resolution requires all package.json files to be present
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY src/apps/ec/backend/package.json        ./src/apps/ec/backend/
COPY src/apps/backoffice/backend/package.json ./src/apps/backoffice/backend/
COPY src/apps/backoffice/frontend/package.json ./src/apps/backoffice/frontend/
COPY e2e/package.json ./e2e/

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --filter @ec-monitoring-agent/e2e --frozen-lockfile

COPY e2e/ ./e2e/

CMD ["pnpm", "--filter", "@ec-monitoring-agent/e2e", "run", "test"]
