#!/usr/bin/env bash
# M6 gate: hardening — alerts/incidents, standup visibility, backup script.
set -euo pipefail
H="Authorization: Bearer ${OPERATOR_TOKEN:-local-dev-token}"
API="${API:-http://localhost:8080}"

echo "· alerts list";        curl -fsS -H "$H" "$API/api/v1/alerts?resolved=all" | grep -q '"incidents"'
echo "· alerts open count";  curl -fsS -H "$H" "$API/api/v1/alerts" | grep -q '"open"'
echo "· standup latest";     curl -fsS -H "$H" "$API/api/v1/conductor/standup/latest" >/dev/null
echo "· backup script is executable"; test -x scripts/backup_db.sh
echo "M6 SMOKE GREEN — run scripts/backup_db.sh on a schedule (cron/CronJob); DATABASE_URL required"
