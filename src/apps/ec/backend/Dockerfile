# Build context is repo root (docker-compose sets context: .)

# ── pruner: turbo prune で ec-backend に必要な資材のみ抽出 ────
FROM node:24-slim AS pruner
RUN npm install -g turbo@2.9.18
WORKDIR /app
COPY . .
RUN turbo prune @ec-monitoring-agent/ec-backend --docker

# ── deps: pruned な資材のみで pnpm install ───────────────────
FROM node:24-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
# backoffice の package.json は turbo prune が除外済み
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ── dev (local): source はvolume-mounted via docker-compose ──
FROM deps AS dev
EXPOSE 3000
CMD ["pnpm", "run", "dev:ec"]

# ── prod: source を焼き込み ───────────────────────────────────
FROM deps AS prod
# out/full/ は ec-backend ソースのみ（src/Contexts/ は含まれない）
COPY --from=pruner /app/out/full/ .
# src/Contexts は TypeScript import 参照のため追加（turbo prune の対象外）
COPY --chown=node:node tsconfig.base.json tsconfig.json ./
COPY --chown=node:node src/Contexts ./src/Contexts
EXPOSE 3000
USER node
CMD ["pnpm", "run", "start:ec"]
