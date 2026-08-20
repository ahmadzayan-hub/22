#!/usr/bin/env bash
# M5 gate: Dashboard / Funnel / Task board — live APIs backing the UI pages.
set -euo pipefail
H="Authorization: Bearer ${OPERATOR_TOKEN:-local-dev-token}"
API="${API:-http://localhost:8080}"

echo "· dashboard summary"; curl -fsS -H "$H" "$API/api/v1/dashboard/summary" | grep -q '"pipeline"'
echo "· funnel cascade";    curl -fsS -H "$H" "$API/api/v1/funnel" | grep -q '"stages"'
echo "· funnel journeys";   curl -fsS -H "$H" "$API/api/v1/funnel/journeys" | grep -q '"journeys"'
echo "· task list";         curl -fsS -H "$H" "$API/api/v1/tasks" | grep -q '"counts"'
echo "· task create+move";  ID=$(curl -fsS -H "$H" -X POST -H 'Content-Type: application/json' \
                                 -d '{"title":"m5 smoke task"}' "$API/api/v1/tasks" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
                             curl -fsS -H "$H" -X PATCH -H 'Content-Type: application/json' \
                                 -d '{"state":"doing"}' "$API/api/v1/tasks/$ID" | grep -q '"state":"doing"'
echo "M5 SMOKE GREEN — dashboard/funnel/tasks pages fetch these routes at web/app/{dashboard,funnel,tasks}"
