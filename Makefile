.PHONY: infra-up infra-down \
        ec-up ec-down ec-restart ec-logs ec-build \
        bo-up bo-down bo-restart bo-logs bo-build \
        front-up front-down front-restart front-logs front-build \
        up down rebuild test integration e2e e2e-prod swagger \
        seed \
        prune prune-all

# ENV=local (default) or ENV=prod
ENV ?= local

COMPOSE_FILES_local := -f docker-compose.yml -f docker-compose.local.yml
COMPOSE_FILES_prod  := -f docker-compose.yml -f docker-compose.prod.yml
DC := docker compose $(COMPOSE_FILES_$(ENV))

# ── Infra ─────────────────────────────────────────────────────
infra-up:
	$(DC) up -d mongo rabbitmq elasticsearch

infra-down:
	$(DC) stop mongo rabbitmq elasticsearch

# ── EC ────────────────────────────────────────────────────────
ec-up: infra-up
	$(DC) up -d ec-backend

ec-down:
	$(DC) stop ec-backend

ec-restart:
	$(DC) restart ec-backend

ec-logs:
	$(DC) logs -f ec-backend

ec-build:
	$(DC) build ec-backend

# ── Backoffice backend ────────────────────────────────────────
bo-up: infra-up
	$(DC) up -d backoffice-backend

bo-down:
	$(DC) stop backoffice-backend

bo-restart:
	$(DC) restart backoffice-backend

bo-logs:
	$(DC) logs -f backoffice-backend

bo-build:
	$(DC) build backoffice-backend

# ── Backoffice frontend ───────────────────────────────────────
# depends_on で ec-backend → backoffice-backend まで連鎖起動する
front-up:
	$(DC) up -d backoffice-frontend
	@echo "Backoffice UI: http://localhost:5173"

front-down:
	$(DC) stop backoffice-frontend

front-restart:
	$(DC) restart backoffice-frontend

front-logs:
	$(DC) logs -f backoffice-frontend

front-build:
	$(DC) build backoffice-frontend

# ── All ───────────────────────────────────────────────────────
# seedのデータ変更後は再度make seedしないとサービスに反映されないリスク
up: ec-up bo-up front-up

down:
	$(DC) down

rebuild:
	$(DC) build && $(DC) up -d

# ── Test ──────────────────────────────────────────────────────
test:
	pnpm test

## backoffice backend の結合テスト（Mongo + RabbitMQ が必要）
test-integration: infra-up
	pnpm --filter @ec-monitoring-agent/backoffice-backend run test:integration; \
	status=$$?; \
	$(MAKE) infra-down; \
	exit $$status

## E2E: CI 用（Docker Compose でサービス起動 → mock モードで全テスト実行）
## infra-up が RabbitMQ を起動し直すと、既存のまま動いている backend は
## AMQP consumer の接続が切れたままになる（自動再接続しない）。
## そのため e2e 直前に backend を restart し、稼働中の broker へ確実に繋ぎ直す。
e2e: ec-up bo-up
	$(DC) restart ec-backend backoffice-backend
	$(DC) run --build --rm e2e

## E2E: CD smoke 用（デプロイ済みサービスに対して実行 / URL を環境変数で渡す）
## 例: make e2e-prod EC_BASE_URL=https://ec.prod.example.com BACKOFFICE_BASE_URL=https://backoffice.prod.example.com
e2e-prod:
	EC_BASE_URL=$(EC_BASE_URL) BACKOFFICE_BASE_URL=$(BACKOFFICE_BASE_URL) pnpm test:e2e:prod

swagger: ec-up
	$(DC) --profile swagger up -d swagger-ui
	@echo "Swagger UI: http://localhost:8080"

# ── Seed ──────────────────────────────────────────────────────
seed:
	curl -X POST http://localhost:3001/demo/reset 

# ── Cleanup ───────────────────────────────────────────────────
prune:
	docker image prune -f

prune-all:
	docker system prune -af --volumes
