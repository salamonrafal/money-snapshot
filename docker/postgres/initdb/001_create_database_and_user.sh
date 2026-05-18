#!/usr/bin/env bash
set -euo pipefail

source_sql="/docker-init-source/001_create_database_and_user.sql"
section_1_sql="$(mktemp)"
section_2_sql="$(mktemp)"
trap 'rm -f "$section_1_sql" "$section_2_sql"' EXIT
app_database="${DB_URL##*/}"
app_database="${app_database%%\?*}"
app_database="${APP_DB_NAME:-$app_database}"

awk '
  /^-- Section 1:/ { in_section = 1; next }
  /^-- Section 2:/ { in_section = 0 }
  in_section { print }
' "$source_sql" > "$section_1_sql"

awk '
  /^-- Section 2:/ { in_section = 1; next }
  in_section { print }
' "$source_sql" > "$section_2_sql"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set app_database="$app_database" \
  --set app_user="$DB_USERNAME" \
  --set app_password="$DB_PASSWORD" \
  --file "$section_1_sql"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$app_database" \
  --set ON_ERROR_STOP=1 \
  --set app_database="$app_database" \
  --set app_user="$DB_USERNAME" \
  --file "$section_2_sql"
