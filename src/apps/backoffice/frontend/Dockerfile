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

# ── build: static assets を生成 ──────────────────────────
FROM deps AS build
COPY --from=pruner /app/out/full/ .
# src/Contexts は workspace package でないため turbo prune に含まれない。
# @monitoring/* alias の解決に必要なので Monitoring コンテキストをまるごとコピーする。
# tsconfig の include は src のみ・vite は import されたファイルしかバンドルしないため、
# 余分な .ts はこのビルド中間レイヤーに置かれるだけで成果物・コンパイル対象には混入しない。
# contracts/ だけを絞り込むと contracts が同階層 domain 型を import した瞬間に本番ビルドだけ壊れる
# （ローカル/`make up` は全ソース可視のため検知できない）ため、保守性を優先して全コピーとする。
COPY --from=pruner /app/src/Contexts/Monitoring ./src/Contexts/Monitoring
RUN pnpm run --filter @ec-monitoring-agent/backoffice-frontend build

# ── runner: nginx で static 配信 + API リバースプロキシ ──
FROM nginx:alpine AS runner
RUN apk add --no-cache gettext
COPY --from=build /app/src/apps/backoffice/frontend/dist /usr/share/nginx/html
COPY src/apps/backoffice/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
# nginx docker image の公式 entrypoint が /etc/nginx/templates/*.template を
# envsubst で処理して /etc/nginx/conf.d/ に出力してから nginx を起動する
CMD ["nginx", "-g", "daemon off;"]
