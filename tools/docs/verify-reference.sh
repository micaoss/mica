#!/usr/bin/env bash
# Holds reference/http-api, reference/settings and reference/cli (English and
# Chinese) to the mica-core release they are written from, named in
# tools/docs/reference-core.pin. Read-only: it fetches and compares.
#
#   bash tools/docs/verify-reference.sh          (or: make docs-verify-world)
#
# What is compared is tools/docs/verify-reference.py's docstring: the API's
# routes against openapi.json, the settings keys against the micad-settings
# model, the `mica` verbs, exit codes and `mica set` paths against the CLI's
# source. Default values, limits, prose and output formats are not compared.
#
# WHY IN docs-verify-world. It reads another repository over the network, as
# verify-world.sh does, and for the same reason it is not in `make docs-verify`.
#
# THE READER IS INJECTABLE so the negative tests need no network:
# MICA_REFERENCE_READER names a command called as
# `<cmd> file <repo> <ref> <path>` or `<cmd> list <repo> <ref> <dir>`.
# Unset, the reader is `gh`. MICA_REFERENCE_DOCS and MICA_REFERENCE_PIN
# point the check at another documentation root and pin, for the tests.
#
# NO SILENT PASS. A file that cannot be fetched exits 2: a check that cannot
# reach its subject must not look like a check that found nothing wrong.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAME="tools/docs/verify-reference.sh"
DOCS="${MICA_REFERENCE_DOCS:-${ROOT}/docs}"
PIN="${MICA_REFERENCE_PIN:-${ROOT}/tools/docs/reference-core.pin}"
READER="${MICA_REFERENCE_READER:-}"
REPO="micaoss/mica-core"

[ -f "$PIN" ] || { echo "${NAME}: no pin at ${PIN}" >&2; exit 2; }
REF="$(tr -d '[:space:]' <"$PIN")"
[ -n "$REF" ] || { echo "${NAME}: the pin at ${PIN} is empty" >&2; exit 2; }

if [ -z "$READER" ] && ! command -v gh >/dev/null 2>&1; then
    echo "${NAME}: no gh and no MICA_REFERENCE_READER; cannot reach ${REPO}" >&2
    exit 2
fi

read_file() { # <path>
    if [ -n "$READER" ]; then "$READER" file "$REPO" "$REF" "$1"; else
        gh api -H 'Accept: application/vnd.github.raw' "repos/${REPO}/contents/$1?ref=${REF}"
    fi
}

read_dir() { # <dir>
    if [ -n "$READER" ]; then "$READER" list "$REPO" "$REF" "$1"; else
        gh api "repos/${REPO}/contents/$1?ref=${REF}" --jq '.[].name'
    fi
}

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

fetch() { # <path>
    mkdir -p "${WORK}/$(dirname "$1")"
    read_file "$1" >"${WORK}/$1" || { echo "${NAME}: cannot read ${REPO}:$1 at ${REF}" >&2; exit 2; }
}

fetch crates/mica-apid/openapi.json
fetch crates/micad/src/cli.rs
fetch crates/micad/src/cli/settings.rs
fetch crates/micad-settings/src/model.rs
models="$(read_dir crates/micad-settings/src/model)" \
    || { echo "${NAME}: cannot list ${REPO}:crates/micad-settings/src/model at ${REF}" >&2; exit 2; }
for model in $models; do
    case "$model" in
        *.rs) fetch "crates/micad-settings/src/model/${model}" ;;
    esac
done

python3 "${ROOT}/tools/docs/verify-reference.py" "$WORK" "$DOCS" "$REF"
