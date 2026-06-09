#!/usr/bin/env bash
set -euo pipefail
# SAMAKIA-VECTOR verification test — reusable, permanent
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
PASS=0; FAIL=0

check() {
  local name="$1" cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then echo "  ✅ $name"; PASS=$((PASS+1))
  else echo "  ❌ $name"; FAIL=$((FAIL+1)); fi
}

echo "SAMAKIA-VECTOR Verification"
echo "=========================="

# Cluster health
check "node-1 health" "curl -sf ${QDRANT_URL}/healthz"
check "node-2 health" "curl -sf http://localhost:6335/healthz"
check "node-3 health" "curl -sf http://localhost:6336/healthz"

# API accessibility
check "collections endpoint" "curl -sf ${QDRANT_URL}/collections"
check "version endpoint" "curl -sf ${QDRANT_URL}"

# Docker containers
check "container qdrant-1 running" "docker ps --format '{{.Names}}' | grep -q samakia-vector-1"
check "container qdrant-2 running" "docker ps --format '{{.Names}}' | grep -q samakia-vector-2"
check "container qdrant-3 running" "docker ps --format '{{.Names}}' | grep -q samakia-vector-3"

# Restart policy
check "restart policy (always/unless-stopped)" "docker inspect samakia-vector-1 --format '{{.HostConfig.RestartPolicy.Name}}' | grep -qE 'always|unless-stopped'"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && echo "STATUS: ALL GREEN ✅" || echo "STATUS: FAILURES ❌"
exit $FAIL
