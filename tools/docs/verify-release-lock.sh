#!/usr/bin/env bash
# Proves every test vector of docs/design/release-lock.md against its expected
# result with the reference checker. Read-only.
#
#   bash tools/docs/verify-release-lock.sh          (or: make docs-verify)
#
# docs/design/release-lock/vectors/expected.tsv lists each vector: its path,
# `valid` or `refused`, the refusal rule, and the mode (`ci`, `local` or
# `offline`). A vector whose result or rule differs is a finding, and so is a
# vector file that expected.tsv does not list. Zero vectors is a failure: the
# check would pass by finding nothing.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

V=docs/design/release-lock/vectors
FAIL=0
CHECKS=0

fail() { echo "  FAIL $*" >&2; FAIL=$((FAIL + 1)); }

echo "tools/docs/verify-release-lock.sh: release lock, pins and repos vectors"

listed=()
while IFS=$'\t' read -r path result rule mode; do
    [[ $path == '#'* ]] && continue
    listed+=("$path")
    case $path in
        lock/*)  got=$(python3 tools/docs/release-lock-check.py lock "$V/$path") ;;
        upstream/*) got=$(python3 tools/docs/release-lock-check.py upstream "$V/$path") ;;
        pins/*)  got=$(python3 tools/docs/release-lock-check.py pins "$V/$path" "$mode") ;;
        repos/*) got=$(python3 tools/docs/release-lock-check.py repos "$V/$path" "$mode") ;;
        *)       got="unknown vector kind" ;;
    esac
    want=$result
    [ "$result" = refused ] && want="refused $rule"
    CHECKS=$((CHECKS + 1))
    [ "$got" = "$want" ] || fail "$path: expected '$want', got '$got'"
done < "$V/expected.tsv"

[ "${#listed[@]}" -gt 0 ] || fail "$V/expected.tsv lists no vectors"

# Every vector on disk is listed: a lock or upstream lock file, a pins case directory (locks and pins/), a repos case directory.
while IFS= read -r vector; do
    CHECKS=$((CHECKS + 1))
    printf '%s\n' "${listed[@]}" | grep -qxF "$vector" || fail "$vector is not listed in expected.tsv"
done < <(cd "$V" && { find lock upstream -name '*.lock'; find pins -mindepth 2 -maxdepth 2 -type d; find repos -mindepth 1 -maxdepth 1 -type d; } | sort)

if [ "$FAIL" -gt 0 ]; then
    echo "tools/docs/verify-release-lock.sh: $FAIL FAILED, $((CHECKS - FAIL)) passed" >&2
    exit 1
fi
echo "tools/docs/verify-release-lock.sh: $CHECKS/$CHECKS PASS"
