SHELL := /usr/bin/env bash
PNPM := corepack pnpm

.PHONY: install dev

install:
	$(PNPM) install

dev:
	$(PNPM) dev
