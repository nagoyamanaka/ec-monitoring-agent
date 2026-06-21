# Build context is repo root (docker-compose sets context: .)

# ── pruner: turbo prune で backoffice-backend に必要な資材のみ抽出 ──
FROM node:24-slim AS pruner
RUN npm install -g turbo@2.9.18
WORKDIR /app
COPY . .
RUN turbo prune @ec-monitoring-agent/backoffice-backend --docker

# ── deps: pruned な資材のみで pnpm install ───────────────────
FROM node:24-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ── dev (local): source は docker-compose で volume-mount ──
FROM deps AS dev
EXPOSE 3001
CMD ["pnpm", "run", "dev:backoffice"]

# ── prod: source を焼き込み ───────────────────────────────────
FROM deps AS prod
COPY --from=pruner /app/out/full/ .
# src/Contexts は TypeScript import 参照のため追加（turbo prune の対象外）
COPY --chown=node:node tsconfig.base.json tsconfig.json ./
COPY --chown=node:node src/Contexts ./src/Contexts
EXPOSE 3001
USER node
CMD ["pnpm", "run", "start:backoffice"]
