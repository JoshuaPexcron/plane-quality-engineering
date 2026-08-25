#!/usr/bin/env bash
# Polls until the Plane API answers. "docker compose up -d" only means the
# containers started; on first boot the API stays down (proxy answers 502)
# until all database migrations have run, which takes a few minutes.
set -euo pipefail

url="${PLANE_BASE_URL:-http://localhost}/api/instances/"
timeout="${WAIT_TIMEOUT_SECONDS:-420}"
elapsed=0

until [ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" = "200" ]; do
  if [ "$elapsed" -ge "$timeout" ]; then
    echo "Plane did not become ready within ${timeout}s" >&2
    exit 1
  fi
  sleep 5
  elapsed=$((elapsed + 5))
  echo "waiting for Plane... (${elapsed}s)"
done

echo "Plane is ready."
