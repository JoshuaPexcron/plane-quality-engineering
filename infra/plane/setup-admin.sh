#!/usr/bin/env bash
# Creates the instance admin account on a fresh Plane instance. This is the
# API equivalent of the one-time "/god-mode/" setup form, so CI can start
# from an empty database without any manual step.
# Skips when the instance is already set up (safe to run locally).
set -euo pipefail

base="${PLANE_BASE_URL:-http://localhost}"
email="${PLANE_ADMIN_EMAIL:?set PLANE_ADMIN_EMAIL}"
password="${PLANE_ADMIN_PASSWORD:?set PLANE_ADMIN_PASSWORD}"

if curl -s "$base/api/instances/" | grep -q '"is_setup_done":true'; then
  echo "Instance already set up, skipping."
  exit 0
fi

# Django needs a CSRF token (cookie + form field) and a matching Referer,
# exactly like a browser would send them.
jar=$(mktemp)
csrf=$(curl -s -c "$jar" "$base/auth/get-csrf-token/" | sed 's/.*"csrf_token":"\([^"]*\)".*/\1/')

# The endpoint answers with a redirect in both outcomes; on failure the
# error is only visible in the redirect target (?error_code=...).
headers=$(mktemp)
curl -s -b "$jar" -D "$headers" -o /dev/null \
  -X POST "$base/api/instances/admins/sign-up/" \
  -H "Referer: $base/" \
  -H "X-CSRFToken: $csrf" \
  --data-urlencode "csrfmiddlewaretoken=$csrf" \
  --data-urlencode "email=$email" \
  --data-urlencode "password=$password" \
  --data-urlencode "first_name=CI" \
  --data-urlencode "last_name=Admin" \
  --data-urlencode "company_name=CI" \
  --data-urlencode "is_telemetry_enabled=false"

# The redirect hides the real outcome, so verify the state we care about.
if curl -s "$base/api/instances/" | grep -q '"is_setup_done":true'; then
  echo "Instance admin created."
else
  echo "Admin sign-up failed. Response headers:" >&2
  cat "$headers" >&2
  exit 1
fi
