#!/usr/bin/env bash
# Database backup. The research data lives here and cannot be re-collected,
# so run this on a schedule, not only before upgrades.
#
#   ./tools/backup_db.sh                 # into ./backups
#   ./tools/backup_db.sh /mnt/backups    # into another directory
#
# Restore:
#   gunzip -c backups/<file>.sql.gz | docker compose -f compose.prod.yaml exec -T db \
#     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${1:-backups}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"
KEEP_DAYS="${KEEP_DAYS:-30}"

if [[ ! -f .env ]]; then
  echo "error: .env not found - run from the repository root" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

POSTGRES_USER="${POSTGRES_USER:-gesture}"
POSTGRES_DB="${POSTGRES_DB:-gesture_db}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/gesture_db-$STAMP.sql.gz"

echo "Backing up $POSTGRES_DB -> $TARGET"
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip > "$TARGET"

SIZE="$(du -h "$TARGET" | cut -f1)"
echo "Done: $TARGET ($SIZE)"

if [[ "$KEEP_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -name 'gesture_db-*.sql.gz' -type f -mtime "+$KEEP_DAYS" -print -delete
fi
