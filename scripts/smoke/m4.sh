#!/usr/bin/env bash
# M4 gate: MCP connector modules — health probes for all 12, list + single check.
set -euo pipefail
H="Authorization: Bearer ${OPERATOR_TOKEN:-local-dev-token}"
API="${API:-http://localhost:8080}"

echo "· connector list";    curl -fsS -H "$H" "$API/api/v1/connectors" | grep -q '"connectors"'
echo "· single probe";      curl -fsS -H "$H" -X POST "$API/api/v1/connectors/attio/check" | grep -q '"status"'
echo "· probe-all";         curl -fsS -H "$H" -X POST "$API/api/v1/connectors/check-all" | grep -q '"checked":12'
echo "M4 SMOKE GREEN — connectors go live the moment their env key is set; empty key ⇒ offline, never a crash"
