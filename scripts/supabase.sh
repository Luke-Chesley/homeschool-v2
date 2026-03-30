#!/usr/bin/env bash
set -euo pipefail

run_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
    return
  fi

  npx supabase@latest "$@"
}

command_name="${1:-status}"
shift || true

case "$command_name" in
  start)
    run_supabase start "$@"
    ;;
  stop)
    run_supabase stop "$@"
    ;;
  status)
    run_supabase status "$@"
    ;;
  db-reset)
    run_supabase db reset "$@"
    ;;
  *)
    echo "Unknown command: $command_name"
    echo "Usage: ./scripts/supabase.sh {start|stop|status|db-reset}"
    exit 1
    ;;
esac
