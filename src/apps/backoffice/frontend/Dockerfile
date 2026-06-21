# Build context is repo root (docker-compose sets context: .)

# ── pruner: turbo prune で backoffice-frontend に必要な資材のみ抽出 ──
FROM node:24-slim AS pruner
RUN npm install -g turbo@2.9.18
WORKDIR /app
COPY . .
RUN turbo prune @ec-monitoring-agent/backoffice-frontend --docker

# ── deps: pruned な資材のみで pnpm install ───────────────────
FROM node:24-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ── dev (local): source は docker-compose で volume-mount ──
# 0.0.0.0 待ち受けは vite.config.ts の server.host で有効化済み
FROM deps AS dev
EXPOSE 5173
CMD ["pnpm", "run", "dev:frontend"]
