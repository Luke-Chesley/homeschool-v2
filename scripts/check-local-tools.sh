#!/usr/bin/env bash
set -euo pipefail

missing=0

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for local Supabase."
  missing=1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required for the fallback Supabase and Inngest CLI flow."
  missing=1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "corepack is required to run pnpm from package.json."
  missing=1
fi

if [[ "$missing" -eq 1 ]]; then
  exit 1
fi

echo "Local platform prerequisites look available."
