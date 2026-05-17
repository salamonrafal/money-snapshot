#!/usr/bin/env bash
set -euo pipefail

source_sql="/docker-init-source/001_create_database_and_user.sql"
section_1_sql="$(mktemp)"
section_2_sql="$(mktemp)"

awk '
  /^-- Section 1:/ { in_section = 1; next }
  /^-- Section 2:/ { in_section = 0 }
  in_section { print }
' "$source_sql" > "$section_1_sql"

awk '
  /^-- Section 2:/ { in_section = 1; next }
  in_section { print }
' "$source_sql" > "$section_2_sql"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file "$section_1_sql"
psql --username "$POSTGRES_USER" --dbname "money_snapshot" --file "$section_2_sql"
