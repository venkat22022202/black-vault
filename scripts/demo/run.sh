#!/usr/bin/env bash
# BlackVault end-to-end demo — real app, real Postgres, real Redis, mock LLM.
#
#   DATABASE_URL=postgres://user@127.0.0.1:5432/blackvault_demo \
#   REDIS_PORT=6379 \
#   scripts/demo/run.sh
#
# Needs a Postgres database you can throw away and a running redis-server.
# No Clerk / Neon / Upstash / provider accounts required.
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${DATABASE_URL:?set DATABASE_URL to a throwaway Postgres database}"
# The demo force-pushes the schema: refuse anything but a local database.
case "$DATABASE_URL" in
  *@localhost[:/]*|*@127.0.0.1[:/]*|*://localhost[:/]*|*://127.0.0.1[:/]*) ;;
  *) [ "${DEMO_ALLOW_REMOTE_DB:-}" = 1 ] || { echo "Refusing non-local DATABASE_URL (set DEMO_ALLOW_REMOTE_DB=1 to override)"; exit 1; } ;;
esac
REDIS_PORT="${REDIS_PORT:-6379}"
APP_PORT="${APP_PORT:-3100}"
SHIM_PORT="${SHIM_PORT:-8079}"
MOCK_PORT="${MOCK_PORT:-8090}"
LOG_DIR="${LOG_DIR:-$(mktemp -d)}"

export DATABASE_URL
export VAULT_MASTER_KEY="$(openssl rand -hex 32)"
export MOCK_REAL_KEY="sk-demo-$(openssl rand -hex 8)"
export SHIM_TOKEN="demo-$(openssl rand -hex 8)"
export UPSTASH_REDIS_REST_URL="http://127.0.0.1:${SHIM_PORT}"
export UPSTASH_REDIS_REST_TOKEN="$SHIM_TOKEN"
export BLACKVAULT_UPSTREAM_OPENAI="http://127.0.0.1:${MOCK_PORT}"
export NEXT_TELEMETRY_DISABLED=1

pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

echo "→ schema"
npx drizzle-kit push --force >"$LOG_DIR/schema.log" 2>&1

echo "→ upstash shim :$SHIM_PORT → redis :$REDIS_PORT, mock LLM :$MOCK_PORT"
SHIM_PORT=$SHIM_PORT REDIS_PORT=$REDIS_PORT node scripts/demo/upstash-shim.mjs >"$LOG_DIR/shim.log" 2>&1 & pids+=($!)
MOCK_PORT=$MOCK_PORT node scripts/demo/mock-llm.mjs >"$LOG_DIR/mock.log" 2>&1 & pids+=($!)

echo "→ next dev :$APP_PORT (logs: $LOG_DIR/app.log)"
npx next dev -p "$APP_PORT" -H 127.0.0.1 >"$LOG_DIR/app.log" 2>&1 & pids+=($!)
for _ in $(seq 1 120); do
  curl -sf -o /dev/null "http://127.0.0.1:${APP_PORT}/api/health" && break
  sleep 1
done

echo "→ seed demo user, vaulted key, 7 agent tokens"
TOKENS="$(node --no-warnings scripts/demo/seed.mjs)"
export TOKENS

APP_URL="http://127.0.0.1:${APP_PORT}" SHIM_URL="$UPSTASH_REDIS_REST_URL" node scripts/demo/scenario.mjs
