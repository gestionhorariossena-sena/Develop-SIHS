#!/usr/bin/env bash
set -euo pipefail

supabase start >/dev/null
supabase db reset --local --sql-paths ./seed.sql
"$(dirname "$0")/demo-up.sh"
