#!/usr/bin/env bash
set -euo pipefail

docker compose -f compose.demo.yml down --remove-orphans
supabase stop
