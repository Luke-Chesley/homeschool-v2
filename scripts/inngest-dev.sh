#!/usr/bin/env bash
set -euo pipefail

serve_url="${INNGEST_SERVE_URL:-http://127.0.0.1:3000/api/inngest}"

if command -v inngest >/dev/null 2>&1; then
  exec inngest dev -u "$serve_url"
fi

exec npx inngest-cli@latest dev -u "$serve_url"
