.PHONY: infra-up infra-down \
        ec-up ec-down ec-restart ec-logs ec-build \
        up down rebuild test e2e \
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

# ── All ───────────────────────────────────────────────────────
up: ec-up

down:
	$(DC) down

rebuild:
	$(DC) build && $(DC) up -d

# ── Test ──────────────────────────────────────────────────────
test:
	pnpm test

e2e: ec-up
	$(DC) run --rm e2e

# ── Cleanup ───────────────────────────────────────────────────
prune:
	docker image prune -f

prune-all:
	docker system prune -af --volumes
