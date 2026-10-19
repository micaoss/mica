#!/usr/bin/env bash
# Negative tests for tools/docs/verify-citations.sh, against fixture trees and
# documents: no network.
#
#   bash tools/docs/verify-citations-test.sh          (or: make docs-verify-test)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFIER="${HERE}/verify-citations.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT
mkdir -p "${WORK}/trees" "${WORK}/docs/docs"
printf 'crates/micad/src/main.rs\nREADME.md\n' >"${WORK}/trees/mica-core.txt"

FAIL=0 CHECKS=0
run() {  # <expected exit> <description> <document body>
    printf '%s\n' "$3" >"${WORK}/docs/docs/page.md"
    CHECKS=$((CHECKS + 1))
    if MICA_CITE_TREES="${WORK}/trees" MICA_CITE_DOCS="${WORK}/docs" bash "$VERIFIER" >"${WORK}/out" 2>&1; then got=0; else got=$?; fi
    if [ "$got" -eq "$1" ]; then echo "  PASS $2"; else echo "  FAIL $2 (exit $got)" >&2; cat "${WORK}/out" >&2; FAIL=$((FAIL + 1)); fi
}

echo "tools/docs/verify-citations-test.sh: cross-repository citations"
run 0 "a file that exists passes" 'See `mica-core:crates/micad/src/main.rs`.'
run 0 "a directory that exists passes" 'See `mica-core:crates/micad/` and `mica-core:crates`.'
run 0 "a glob that matches passes" 'See `mica-core:crates/*/src/main.rs`.'
run 0 "a make target is not a path" 'Run `mica-core:make test`.'
run 1 "a moved file is refused" 'See `mica-core:micad/src/main.rs`.'
run 1 "a repository with no tree is refused" 'See `mica-podman:README.md`.'

if [ "$FAIL" -gt 0 ]; then
    echo "tools/docs/verify-citations-test.sh: $FAIL FAILED, $((CHECKS - FAIL)) passed" >&2
    exit 1
fi
echo "tools/docs/verify-citations-test.sh: $CHECKS/$CHECKS PASS"
