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
        vectors-pin/*) got=$(python3 tools/docs/release-lock-check.py vectors-pin "$V/$path") ;;
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
# The membership test is a shell loop, not `printf | grep -qxF`: under
# `pipefail`, `grep -q` exits on the first match and the still-writing printf
# dies of SIGPIPE, so a match early in the list reports the pipeline as failed.
is_listed() {
    local candidate
    for candidate in "${listed[@]}"; do
        [ "$candidate" = "$1" ] && return 0
    done
    return 1
}

while IFS= read -r vector; do
    CHECKS=$((CHECKS + 1))
    is_listed "$vector" || fail "$vector is not listed in expected.tsv"
done < <(cd "$V" && { find lock upstream -name '*.lock'; find vectors-pin -name '*.pin'; find pins -mindepth 2 -maxdepth 2 -type d; find repos -mindepth 1 -maxdepth 1 -type d; } | sort)

# 9.3: every refused lock vector declares the valid vector it is written
# against. The relation decides what can be asserted: `edit-of` is a small edit
# and carries a line bound, `minimal-of` is an independently written lock of the
# same shape and carries none. The pairing is DECLARED rather than derived
# because deriving it by smallest diff picked a mica-build-env shape against an
# offline mica-core lock (2026-09-20).
DERIV="$V/derived-from.tsv"
[ -s "$DERIV" ] || fail "$DERIV is missing or empty"
declared=()
while IFS=$'\t' read -r vector relation sibling; do
    case "$vector" in '#'*|'') continue ;; esac
    declared+=("$vector")
    CHECKS=$((CHECKS + 1))
    [ -f "$V/$vector" ] || fail "derived-from.tsv names $vector, which does not exist"
    [ -f "$V/$sibling" ] || fail "$vector: sibling $sibling does not exist"
    is_listed "$sibling" || fail "$vector: sibling $sibling is not a listed vector"
    changed=$(diff <(cat "$V/$sibling") <(cat "$V/$vector") | grep -c '^[<>]' || true)
    case "$relation" in
        edit-of)
            [ "$changed" -gt 0 ] || fail "$vector: identical to its sibling $sibling"
            [ "$changed" -le 2 ] || fail "$vector: $changed changed lines against $sibling, more than an edit-of allows" ;;
        minimal-of)
            [ "$changed" -gt 0 ] || fail "$vector: identical to its sibling $sibling" ;;
        *) fail "$vector: unknown relation '$relation'" ;;
    esac
done <"$DERIV"

while IFS= read -r vector; do
    CHECKS=$((CHECKS + 1))
    listed_in_derivation=1
    for candidate in "${declared[@]}"; do
        [ "$candidate" = "$vector" ] && listed_in_derivation=0
    done
    [ "$listed_in_derivation" = 0 ] || fail "$vector declares no derivation in derived-from.tsv"
done < <(cd "$V" && find lock/refused -name '*.lock' | sort)

if [ "$FAIL" -gt 0 ]; then
    echo "tools/docs/verify-release-lock.sh: $FAIL FAILED, $((CHECKS - FAIL)) passed" >&2
    exit 1
fi
echo "tools/docs/verify-release-lock.sh: $CHECKS/$CHECKS PASS"
