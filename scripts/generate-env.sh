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

vault_addr="${VAULT_ADDR:-${VAULT_ADDRESS:-}}"
vault_token="${VAULT_TOKEN:-}"
vault_path="${VAULT_PATH:-}"
template_file="${ENV_TEMPLATE_FILE:-.env.example}"
output_file="${ENV_OUTPUT_FILE:-.env.tmp}"

if [ -z "$vault_addr" ]; then
  echo "Missing required environment variable: VAULT_ADDR or VAULT_ADDRESS" >&2
  exit 1
fi

if [ -z "$vault_token" ]; then
  echo "Missing required environment variable: VAULT_TOKEN" >&2
  exit 1
fi

if [ -z "$vault_path" ]; then
  echo "Missing required environment variable: VAULT_PATH" >&2
  exit 1
fi

if [ ! -f "$template_file" ]; then
  echo "Template file does not exist: $template_file" >&2
  exit 1
fi

normalized_addr="${vault_addr%/}"
normalized_path="${vault_path#/}"
vault_url="$normalized_addr/v1/$normalized_path"

response_file="$(mktemp)"
headers_file="$(mktemp)"
trap 'rm -f "$response_file" "$headers_file"' EXIT

printf 'X-Vault-Token: %s\nAccept: application/json\n' "$vault_token" > "$headers_file"

http_status="$(curl -sS \
  -H @"$headers_file" \
  -o "$response_file" \
  -w "%{http_code}" \
  "$vault_url")"

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

payload = json.loads(response_path.read_text())
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
used_keys = set()

def format_env_value(value):
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)

for line in template_lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        result_lines.append(line)
        continue

    key, _sep, _value = line.partition("=")
    key = key.strip()
    if key in secret_data and secret_data[key] is not None:
        result_lines.append(f"{key}={format_env_value(secret_data[key])}")
        used_keys.add(key)
    else:
        result_lines.append(line)

for key in sorted(secret_data):
    if key in used_keys:
        continue
    if not isinstance(key, str):
        continue
    value = secret_data[key]
    if value is None:
        continue
    result_lines.append(f"{key}={format_env_value(value)}")

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
