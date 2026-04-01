#!/usr/bin/env bash
set -euo pipefail

echo "Running typecheck..."
corepack pnpm typecheck

echo "Running UI smoke test..."
BASE_URL="${BASE_URL:-http://localhost:3000}" node ./scripts/ui-smoke-test.mjs
