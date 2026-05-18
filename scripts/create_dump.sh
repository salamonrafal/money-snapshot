#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup_number>"
  echo "Example: $0 000001"
  exit 1
fi

backup_number="$1"
backup_root="$HOME/backups/money_snapshot"
backup_dir="$backup_root/$backup_number"
dump_file="$backup_dir/money_snapshot.dump"

if [ -e "$backup_dir" ]; then
  echo "Backup directory already exists: $backup_dir"
  echo "Dump was not created to avoid overwriting existing data."
  exit 1
fi

mkdir -p "$backup_dir"

docker compose exec -T postgres sh -c 'app_db_name="${APP_DB_NAME:-${DB_URL##*/}}"; app_db_name="${app_db_name%%\?*}"; pg_dump -U "$DB_USERNAME" -d "$app_db_name" --format=custom' \
  > "$dump_file"

echo "Database dump created: $dump_file"
