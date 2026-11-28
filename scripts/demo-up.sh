#!/usr/bin/env bash
set -euo pipefail

# Supabase CLI ejecuta Postgres, Auth, API, Studio y su propio buzón SMTP.
# Compose incorpora además Mailpit dedicado a las invitaciones de SIHS.
# El frontend y backend reciben únicamente
# las credenciales efímeras del stack local.
"$(dirname "$0")/ensure-docker.sh"
supabase start >/dev/null

eval "$(supabase status -o env)"

: "${API_URL:?Supabase local no entregó API_URL}"
: "${DB_URL:?Supabase local no entregó DB_URL}"
: "${ANON_KEY:?Supabase local no entregó ANON_KEY}"
: "${SERVICE_ROLE_KEY:?Supabase local no entregó SERVICE_ROLE_KEY}"

# `supabase start` puede terminar antes de que Kong/API acepte tráfico, o
# devolver éxito aunque Docker haya detenido un servicio durante una
# actualización. No levantar SIHS contra un stack a medio iniciar: la API
# necesita Auth y PostgreSQL desde su primer request.
if ! curl --fail --silent --show-error --max-time 15 "${API_URL}/rest/v1/" >/dev/null; then
  echo "Supabase local no quedó listo en ${API_URL}. Revisa: supabase status y docker ps --filter name=supabase_." >&2
  exit 1
fi

export DEMO_DATABASE_URL="${DB_URL/127.0.0.1/host.docker.internal}"
export DEMO_SUPABASE_INTERNAL_URL="${API_URL/127.0.0.1/host.docker.internal}"
export DEMO_SUPABASE_ANON_KEY="$ANON_KEY"
export DEMO_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

docker compose -f compose.demo.yml up -d --build
