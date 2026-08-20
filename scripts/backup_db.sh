#!/usr/bin/env bash
# Nightly-cron-friendly Postgres backup: pg_dump the whole DB to a timestamped
# file, then prune down to the $BACKUP_RETAIN most recent dumps.
set -euo pipefail
DATABASE_URL="${DATABASE_URL:?set DATABASE_URL}"
DIR="${BACKUP_DIR:-./backups}"
RETAIN="${BACKUP_RETAIN:-14}"

mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$DIR/alkahtani-os-$STAMP.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$OUT"
echo "backed up -> $OUT ($(du -h "$OUT" | cut -f1))"

# prune: keep the $RETAIN newest, delete the rest
ls -1t "$DIR"/alkahtani-os-*.sql.gz 2>/dev/null | tail -n +$((RETAIN + 1)) | while read -r old; do
  rm -f "$old"; echo "pruned -> $old"
done
