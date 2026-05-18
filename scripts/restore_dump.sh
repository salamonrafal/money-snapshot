#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup_number_or_dump_path>"
  echo "Examples:"
  echo "  $0 000001"
  echo "  $0 ~/backups/money_snapshot/000001/money_snapshot.dump"
  exit 1
fi

backup_arg="$1"

if [ -f "$backup_arg" ]; then
  dump_file="$backup_arg"
else
  dump_file="$HOME/backups/money_snapshot/$backup_arg/money_snapshot.dump"
fi

if [ ! -f "$dump_file" ]; then
  echo "Dump file does not exist: $dump_file"
  exit 1
fi

if [ -n "$(docker compose ps --status running -q web)" ]; then
  echo "Stopping web service..."
  docker compose stop web
fi

echo "Starting postgres service..."
docker compose up -d postgres

echo "Waiting for postgres to accept connections..."
for attempt in {1..60}; do
  if docker compose exec -T postgres sh -c 'app_db_name="${APP_DB_NAME:-${DB_URL##*/}}"; app_db_name="${app_db_name%%\?*}"; pg_isready -U "$DB_USERNAME" -d "$app_db_name"' > /dev/null 2>&1; then
    break
  fi

  if [ "$attempt" -eq 60 ]; then
    echo "Postgres did not become ready within 60 seconds."
    exit 1
  fi

  sleep 1
done

echo "Restoring database from: $dump_file"
docker compose exec -T postgres sh -c 'app_db_name="${APP_DB_NAME:-${DB_URL##*/}}"; app_db_name="${app_db_name%%\?*}"; pg_restore -U postgres -d "$app_db_name" --clean --if-exists' \
  < "$dump_file"

echo "Starting full application stack..."
docker compose up -d

echo "Database restore completed."
