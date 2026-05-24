#!/usr/bin/env bash
set -euo pipefail
umask 077

if ! command -v curl >/dev/null 2>&1; then
  echo "Missing required command: curl" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Missing required command: python3" >&2
  exit 1
fi

curl_retry_all_errors_args=()
if curl --help all 2>/dev/null | grep -q -- '--retry-all-errors'; then
  curl_retry_all_errors_args+=(--retry-all-errors)
fi

vault_addr="${VAULT_ADDR:-${VAULT_ADDRESS:-}}"
vault_token="${VAULT_TOKEN:-}"
vault_path="${VAULT_PATH:-}"
template_file="${ENV_TEMPLATE_FILE:-.env.example}"
output_file="${ENV_OUTPUT_FILE:-.env.tmp}"
vault_connect_timeout="${VAULT_CONNECT_TIMEOUT_SECONDS:-5}"
vault_max_time="${VAULT_MAX_TIME_SECONDS:-30}"
vault_retry_count="${VAULT_RETRY_COUNT:-2}"

if [ -z "$vault_addr" ]; then
  echo "Missing required environment variable: VAULT_ADDR or VAULT_ADDRESS" >&2
  exit 1
fi

if [ -z "$vault_token" ]; then
  echo "Missing required environment variable: VAULT_TOKEN" >&2
  exit 1
fi

case "$vault_token" in
  *$'\n'*|*$'\r'*)
    echo "VAULT_TOKEN must not contain newline or carriage return characters" >&2
    exit 1
    ;;
esac

if [ -z "$vault_path" ]; then
  echo "Missing required environment variable: VAULT_PATH" >&2
  exit 1
fi

if [ ! -f "$template_file" ]; then
  echo "Template file does not exist: $template_file" >&2
  exit 1
fi

output_parent_dir="$(dirname "$output_file")"
mkdir -p "$output_parent_dir"
template_realpath="$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$template_file")"
output_realpath="$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$output_file")"

if [ "$template_realpath" = "$output_realpath" ]; then
  echo "Output file must be different from the template file: $output_file" >&2
  exit 1
fi

normalized_addr="${vault_addr%/}"
normalized_path="${vault_path#/}"
vault_url="$normalized_addr/v1/$normalized_path"

tmp_dir="${TMPDIR:-/tmp}"
response_file="$(mktemp "$tmp_dir/generate-env-response.XXXXXX")"
headers_file="$(mktemp "$tmp_dir/generate-env-headers.XXXXXX")"
trap 'rm -f "$response_file" "$headers_file"' EXIT

printf 'X-Vault-Token: %s\nAccept: application/json\n' "$vault_token" > "$headers_file"

if ! http_status="$(curl -sS \
  --connect-timeout "$vault_connect_timeout" \
  --max-time "$vault_max_time" \
  --retry "$vault_retry_count" \
  "${curl_retry_all_errors_args[@]}" \
  -H @"$headers_file" \
  -o "$response_file" \
  -w "%{http_code}" \
  "$vault_url")"; then
  echo "Vault request failed before receiving a valid HTTP response." >&2
  if [ -s "$response_file" ]; then
    cat "$response_file" >&2
  fi
  exit 1
fi

if [ "$http_status" -lt 200 ] || [ "$http_status" -ge 300 ]; then
  echo "Vault request failed with status $http_status" >&2
  cat "$response_file" >&2
  exit 1
fi

python3 - "$response_file" "$template_file" "$output_file" <<'PY'
import json
import pathlib
import tempfile
import sys

response_path = pathlib.Path(sys.argv[1])
template_path = pathlib.Path(sys.argv[2])
output_path = pathlib.Path(sys.argv[3])

try:
    payload = json.loads(response_path.read_text())
except json.JSONDecodeError as exc:
    raise SystemExit(f"Vault response is not valid JSON: {exc}")
if isinstance(payload.get("errors"), list) and payload["errors"]:
    raise SystemExit("Vault returned errors: " + "; ".join(str(item) for item in payload["errors"]))

data = payload.get("data")
if not isinstance(data, dict):
    raise SystemExit("Vault response does not contain a top-level 'data' object")

secret_data = data.get("data") if isinstance(data.get("data"), dict) else data
if not isinstance(secret_data, dict):
    raise SystemExit("Vault response does not contain a secret payload")

template_lines = template_path.read_text().splitlines()
result_lines = []

def format_env_value(value):
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    raise SystemExit(
        f"Vault secret value has unsupported non-scalar type: {type(value).__name__}"
    )

for line in template_lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        result_lines.append(line)
        continue

    key, _sep, _value = line.partition("=")
    key = key.strip()
    if key in secret_data and secret_data[key] is not None:
        result_lines.append(f"{key}={format_env_value(secret_data[key])}")
    else:
        result_lines.append(line)

output_path.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(
    mode="w",
    encoding="utf-8",
    dir=output_path.parent,
    prefix=f".{output_path.name}.",
    delete=False,
) as handle:
    handle.write("\n".join(result_lines) + "\n")
    temp_path = pathlib.Path(handle.name)

temp_path.replace(output_path)
PY

echo "Generated $output_file from Vault path $vault_path"
