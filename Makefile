SHELL := /usr/bin/env bash
PNPM := corepack pnpm

.PHONY: install dev dev-app dev-stack stop-stack status-stack reset-db inngest check-tools typecheck

install:
	$(PNPM) install

dev:
	./scripts/dev.sh

dev-app:
	$(PNPM) dev

dev-stack:
	./scripts/supabase.sh start

stop-stack:
	./scripts/supabase.sh stop

status-stack:
	./scripts/supabase.sh status

reset-db:
	./scripts/supabase.sh db-reset

inngest:
	./scripts/inngest-dev.sh

check-tools:
	./scripts/check-local-tools.sh

typecheck:
	$(PNPM) typecheck
