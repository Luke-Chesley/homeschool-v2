#!/usr/bin/env bash
set -euo pipefail

./scripts/check-local-tools.sh
echo "Starting Next.js on http://localhost:3000"
exec corepack pnpm dev:app
