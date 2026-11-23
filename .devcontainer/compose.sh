#!/usr/bin/env bash
set -euo pipefail

if [[ ${CODESPACES:-} != true || -z ${CODESPACE_NAME:-} || -z ${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-} ]]; then
  printf '%s\n' 'Run this command in a GitHub Codespaces terminal.' >&2
  exit 2
fi

export DATATALK_PREVIEW_HOST="${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec docker compose -f compose.yaml -f .devcontainer/compose.codespaces.yaml "$@"
