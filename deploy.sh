#!/usr/bin/env bash
# Deploy varco-gates on the Oracle server (jlide/DEV Oracle ARM)
# Usage: ./deploy.sh
set -euo pipefail

HOST="paraflu@jlide.duckdns.org"

echo ">> Syncing + building varco-gates on $HOST"

ssh "$HOST" 'set -e
cd ~
if [ ! -d varco-gates ]; then git clone https://github.com/paraflu/varco-gates.git; fi
cd varco-gates
git fetch origin && git checkout main && git pull --ff-only
export ADMIN_PASSWORD="${ADMIN_PASSWORD:?"ADMIN_PASSWORD env required"}"
export HA_TOKEN="${HA_TOKEN:?"HA_TOKEN env required"}"
export HA_BASE_URL="${HA_BASE_URL:-http://192.168.3.27:8123}"
docker compose up -d --build'

echo ">> Smoke test"
sleep 8
ssh "$HOST" 'curl -s -o /dev/null -w "local http_code=%{http_code}\n" http://localhost:3099/' || true
echo ">> Done"

