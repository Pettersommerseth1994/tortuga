#!/bin/sh
# Starter hele Tortuga lokalt med én kommando: database + appen.
#
#   npm run tortuga                 # kun denne maskinen (http://localhost:3000)
#   HOST=0.0.0.0 npm run tortuga    # også fra telefon på samme wifi
#
# Data ligger i .postgres-data/ og beholdes mellom kjøringer. Ctrl-C stopper alt.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Mangler .env. Kjør:  cp .env.example .env  og fyll inn AUTH_SECRET (openssl rand -base64 32)" >&2
  exit 1
fi

DB_PID=""
cleanup() { [ -n "$DB_PID" ] && kill "$DB_PID" 2>/dev/null; wait 2>/dev/null; }
trap cleanup EXIT INT TERM

if lsof -iTCP:5432 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Postgres kjører allerede på :5432 — bruker den."
else
  node scripts/dev-db.mjs > .postgres.log 2>&1 &
  DB_PID=$!
  printf "Starter database"
  for _ in $(seq 1 60); do
    lsof -iTCP:5432 -sTCP:LISTEN >/dev/null 2>&1 && break
    printf "."; sleep 1
  done
  echo
fi

npx prisma db push --skip-generate >/dev/null
npx next build >/dev/null
echo "Tortuga kjører på http://localhost:${PORT:-3000}  (Ctrl-C for å stoppe)"
npx next start -H "${HOST:-127.0.0.1}" -p "${PORT:-3000}"
