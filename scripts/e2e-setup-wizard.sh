#!/usr/bin/env bash
# Runs the install-wizard browser test against a throwaway stack: an empty database
# `loopwise_setup_e2e`, the API on :5917 and Vite on :3917. The dev stack (:5006, :3000) is untouched.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
	set -a
	# shellcheck disable=SC1091
	. ./.env
	set +a
fi

DB_NAME=loopwise_setup_e2e
PG_USER="${POSTGRES_USER:-loopwise}"
export DATABASE_URL="postgresql://${PG_USER}:${POSTGRES_PASSWORD:-loopwise}@localhost:${POSTGRES_PORT:-5435}/${DB_NAME}"
export PORT=5917
export BETTER_AUTH_URL=http://localhost:3917
export QUARRY_API_URL=http://localhost:5917
export TANSTACK_DEVTOOLS_PORT=42070

PIDS=()
cleanup() {
	for pid in "${PIDS[@]:-}"; do
		[ -n "$pid" ] || continue
		pkill -P "$pid" 2>/dev/null || true
		kill "$pid" 2>/dev/null || true
	done
}
trap cleanup EXIT

psql_admin() { docker compose exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c "$1"; }
psql_admin "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)"
psql_admin "CREATE DATABASE ${DB_NAME}"
npm run db:deploy -w @quarry/api

LOG_DIR="$(mktemp -d)"
npm run start -w @quarry/api >"$LOG_DIR/api.log" 2>&1 &
PIDS+=($!)
(cd apps/frontend && npx vite --port 3917 --strictPort >"$LOG_DIR/vite.log" 2>&1) &
PIDS+=($!)

wait_for() {
	for _ in $(seq 1 90); do
		if curl -s -o /dev/null "$1"; then return 0; fi
		sleep 1
	done
	echo "Timed out waiting for $1 (logs in $LOG_DIR)" >&2
	exit 1
}
wait_for http://localhost:5917/graphql
wait_for http://localhost:3917/

SETUP_E2E_TOKEN="$(node -e "console.log(require('node:crypto').createHmac('sha256', process.env.BETTER_AUTH_SECRET).update('quarry-setup-token').digest('hex').slice(0, 32))")"
export SETUP_E2E_TOKEN
export E2E_BASE_URL=http://localhost:3917

cd apps/frontend
npx playwright test e2e/setup-wizard.spec.ts
