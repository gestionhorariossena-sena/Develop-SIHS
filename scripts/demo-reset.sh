#!/usr/bin/env bash
set -euo pipefail

"$(dirname "$0")/ensure-docker.sh"
supabase start >/dev/null
supabase db reset --local --sql-paths ./seed.sql
"$(dirname "$0")/demo-up.sh"
