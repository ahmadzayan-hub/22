#!/usr/bin/env bash
# M3 gate: runtime — vault loader, scheduler, run logging, tmux crews, Conductor.
set -euo pipefail
H="Authorization: Bearer ${OPERATOR_TOKEN:-local-dev-token}"
API="${API:-http://localhost:8080}"

echo "· health";              curl -fsS "$API/health" >/dev/null
echo "· vault sync";          curl -fsS -H "$H" -X POST "$API/api/v1/agents/sync" | grep -q '"synced":3[5-9]'
echo "· roster";              curl -fsS -H "$H" "$API/api/v1/agents" | grep -q 'sales-agent'
echo "· shadow run";          curl -fsS -H "$H" -X POST -H 'Content-Type: application/json' \
                                 -d '{"trigger":"shadow"}' "$API/api/v1/agents/sales-agent/run" | grep -q 'run_id'
echo "· run logged";          curl -fsS -H "$H" "$API/api/v1/conductor/runs?agent=sales-agent" | grep -q 'started_at'
echo "· conductor chat";      curl -fsS -H "$H" -X POST -H 'Content-Type: application/json' \
                                 -d '{"message":"status?"}' "$API/api/v1/conductor/chat" | grep -q 'reply'
echo "· standup";             curl -fsS -H "$H" -X POST "$API/api/v1/conductor/standup" | grep -q 'banner'
echo "· tmux sessions";       curl -fsS -H "$H" "$API/api/v1/conductor/tmux" | grep -q 'sessions'
echo "M3 SMOKE GREEN"
