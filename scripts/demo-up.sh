#!/usr/bin/env bash
set -euo pipefail

# Supabase CLI ejecuta los servicios oficiales (Postgres, Auth, API, Studio y
# Mailpit). El frontend y backend se ejecutan en Compose y reciben únicamente
# las credenciales efímeras del stack local.
supabase start >/dev/null

eval "$(supabase status -o env)"

: "${API_URL:?Supabase local no entregó API_URL}"
: "${DB_URL:?Supabase local no entregó DB_URL}"
: "${ANON_KEY:?Supabase local no entregó ANON_KEY}"
: "${SERVICE_ROLE_KEY:?Supabase local no entregó SERVICE_ROLE_KEY}"

export DEMO_DATABASE_URL="${DB_URL/127.0.0.1/host.docker.internal}"
export DEMO_SUPABASE_INTERNAL_URL="${API_URL/127.0.0.1/host.docker.internal}"
export DEMO_SUPABASE_ANON_KEY="$ANON_KEY"
export DEMO_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

docker compose -f compose.demo.yml up -d --build
