#!/usr/bin/env bash
# Applies every migration to a DISPOSABLE Supabase database, then runs tests/*.sql.
# Never point this at a shared or production database: it writes schema and fixtures.
#
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
#
# CI starts that database with the Supabase CLI (see .github/workflows/ci.yml).
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to a disposable local database}"
case "$DATABASE_URL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing to run: DATABASE_URL must point at a local disposable database." >&2; exit 1 ;;
esac

export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
psql_run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --quiet --no-psqlrc "$@"; }

# Filenames share numeric prefixes (two 007s, 008s, 010s, 012s); plain filename
# order matches the order in docs/SUPABASE_SETUP.md.
for migration in $(ls supabase/migrations/*.sql | LC_ALL=C sort); do
  echo "migrate: $migration"
  psql_run -f "$migration" >/dev/null
done

failed=0
for test_file in $(ls tests/*.sql | LC_ALL=C sort); do
  if psql_run -f "$test_file" >/dev/null; then
    echo "pass: $test_file"
  else
    echo "FAIL: $test_file"
    failed=1
  fi
done
exit "$failed"
