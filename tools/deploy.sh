#!/usr/bin/env bash
# Deploy or update the production stack, with a backup taken first and the
# result verified before the script reports success.
#
#   ./tools/deploy.sh            # build and start, then smoke test
#   ./tools/deploy.sh --pull     # also git pull first
#
# Nothing here is destructive: it never removes volumes, and it stops on the
# first failure so a broken deploy is not reported as a good one.

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"
PULL=false
[[ "${1:-}" == "--pull" ]] && PULL=true

fail() { echo "error: $*" >&2; exit 1; }

command -v docker >/dev/null || fail "docker is not installed"
docker compose version >/dev/null 2>&1 || fail "the docker compose plugin is missing"
[[ -f .env ]] || fail ".env not found - copy .env.example and fill it in"

set -a
# shellcheck disable=SC1091
source .env
set +a

[[ -n "${POSTGRES_PASSWORD:-}" ]] || fail "POSTGRES_PASSWORD is empty in .env"

SITE_ADDRESS="${SITE_ADDRESS:-:80}"
if [[ "$SITE_ADDRESS" == :* ]]; then
  BASE_URL="http://localhost${SITE_ADDRESS}"
  echo "note: SITE_ADDRESS=$SITE_ADDRESS - serving plain HTTP."
  echo "      Browsers only grant camera access over HTTPS or on localhost."
else
  BASE_URL="https://${SITE_ADDRESS}"
fi

if [[ "$PULL" == true ]]; then
  echo "==> Updating source"
  git pull --ff-only
fi

if docker compose -f "$COMPOSE_FILE" ps --status running 2>/dev/null | grep -q db; then
  echo "==> Backing up the database"
  ./tools/backup_db.sh || fail "backup failed - aborting before touching a running system"
else
  echo "==> No running database, skipping backup (first deploy)"
fi

echo "==> Building and starting"
docker compose -f "$COMPOSE_FILE" up --build -d

echo "==> Waiting for the API to become healthy"
for attempt in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    echo "    healthy"
    break
  fi
  if [[ "$attempt" -eq 60 ]]; then
    echo
    docker compose -f "$COMPOSE_FILE" logs --tail 80
    fail "the service did not become healthy within 5 minutes"
  fi
  sleep 5
done

echo "==> Verifying"
if python3 tools/smoke_test.py "$BASE_URL"; then
  echo
  echo "Deployment complete: $BASE_URL"
else
  echo
  echo "The stack is running but some checks failed - see above." >&2
  echo "Logs: docker compose -f $COMPOSE_FILE logs --tail 100" >&2
  exit 1
fi
