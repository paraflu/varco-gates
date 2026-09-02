#!/usr/bin/env bash
# Deploy varco-gates on the Oracle server (jlide)
# Usage: ./deploy.sh <TAG>
set -euo pipefail

TAG="${1:-latest}"
HOST="paraflu@jlide.duckdns.org"
DIR="~/projects/varco-gates"

echo ">> Deploying varco-gates:$TAG to $HOST"

docker build --platform linux/amd64 -t ghcr.io/paraflu/varco-gates:"$TAG" .

# Push to GHCR (needs gh auth token with packages:write)
echo "$GITHUB_TOKEN" | docker login ghcr.io -u paraflu --password-stdin
docker push ghcr.io/paraflu/varco-gates:"$TAG"

echo ">> Remote pull + up"
ssh "$HOST" "cd $DIR && docker compose pull && docker compose up -d"

echo ">> Smoke test"
sleep 5
curl -s -o /dev/null -w "local http_code=%{http_code}\n" http://localhost:3099/ || true

echo ">> Done"

