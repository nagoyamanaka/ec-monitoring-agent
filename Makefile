.PHONY: infra-up infra-down \
        ec-up ec-down ec-restart ec-logs ec-build \
        bo-up bo-down bo-restart bo-logs bo-build \
        front-up front-down front-restart front-logs front-build \
        up down rebuild test e2e swagger \
        prune prune-all

# ENV=local (default) or ENV=prod
ENV ?= local

COMPOSE_FILES_local := -f docker-compose.yml -f docker-compose.local.yml
COMPOSE_FILES_prod  := -f docker-compose.yml -f docker-compose.prod.yml
DC := docker compose $(COMPOSE_FILES_$(ENV))

# ── Infra ─────────────────────────────────────────────────────
infra-up:
	$(DC) up -d mongo rabbitmq

infra-down:
	$(DC) stop mongo rabbitmq

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
up: ec-up bo-up front-up

down:
	$(DC) down

rebuild:
	$(DC) build && $(DC) up -d

# ── Test ──────────────────────────────────────────────────────
test:
	pnpm test

e2e: ec-up
	$(DC) run --rm e2e

swagger: ec-up
	$(DC) --profile swagger up -d swagger-ui
	@echo "Swagger UI: http://localhost:8080"

# ── Cleanup ───────────────────────────────────────────────────
prune:
	docker image prune -f

prune-all:
	docker system prune -af --volumes
