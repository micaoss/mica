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

# The vectors directory is injectable SO THIS GATE CAN BE SHOWN TO FAIL. It ran
# for six days with 355 assertions and no negative test, which made every
# "355/355 PASS" in these records a number nobody had watched go red; the two
# times it was bite-tested, a person mutated a real vector and restored it from
# /tmp, which proves the gate once and leaves nothing behind. Never quote a
# check you have not seen fail -- tools/docs/verify-release-lock-test.sh copies
# the tree, breaks it five ways and requires this script's own message each
# time.
V="${MICA_VECTORS:-docs/design/release-lock/vectors}"
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
    same_rows=no
    diff <(sort "$V/$sibling") <(sort "$V/$vector") >/dev/null && same_rows=yes
    case "$relation" in
        edit-of)
            [ "$changed" -gt 0 ] || fail "$vector: identical to its sibling $sibling"
            [ "$changed" -le 2 ] || fail "$vector: $changed changed lines against $sibling, more than an edit-of allows" ;;
        reorder-of)
            # The relation IS the argument: identical rows in another order, so
            # order is the only rule the vector can break.
            [ "$same_rows" = yes ] || fail "$vector: rows differ from $sibling, so it is not a reorder-of"
            [ "$changed" -gt 0 ] || fail "$vector: identical to its sibling $sibling" ;;
        minimal-of)
            [ "$changed" -gt 0 ] || fail "$vector: identical to its sibling $sibling" ;;
        *) fail "$vector: unknown relation '$relation'" ;;
    esac
    # A vector whose named rule is sort-order must hold exactly its sibling's
    # rows: anything else is an incidental difference, which is what carrying a
    # missing comment line turned out to be on 2026-09-20.
    case "$vector" in
        */unsorted.lock)
            CHECKS=$((CHECKS + 1))
            [ "$same_rows" = yes ] || fail "$vector names sort-order but its rows differ from $sibling" ;;
    esac
done <"$DERIV"

# Every rule each refused vector breaks, not just the first. The collect mode
# under-reports by construction, so this pins a measurement rather than proving
# a property: a vector that starts breaking a second rule, or stops breaking one,
# turns a recorded set into a finding instead of a quiet change (release-lock.md
# 9.4). Column 4 is hand-measured and only its vocabulary can be checked here.
SETS="$V/refusal-sets.tsv"
[ -s "$SETS" ] || fail "$SETS is missing or empty"
while IFS=$'\t' read -r vector outcome rules repaired; do
    case "$vector" in '#'*|'') continue ;; esac
    CHECKS=$((CHECKS + 1))
    case $vector in
        lock/*)     got=$(python3 tools/docs/release-lock-check.py collect lock "$V/$vector") ;;
        upstream/*) got=$(python3 tools/docs/release-lock-check.py collect upstream "$V/$vector") ;;
        *) fail "refusal-sets.tsv names $vector, which is not a lock vector"; continue ;;
    esac
    head=${got%% *}
    sorted=$(echo "${got#* }" | tr ' ' '\n' | sort | tr '\n' ' ')
    sorted=${sorted% }
    case $outcome in
        set)     want_head=refused-set ;;
        stopped) want_head=collect-stopped ;;
        *) fail "$vector: unknown outcome '$outcome'"; continue ;;
    esac
    [ "$head" = "$want_head" ] || fail "$vector: expected $want_head, got '$got'"
    [ "$sorted" = "$rules" ] || fail "$vector: expected rules '$rules', got '$sorted'"
    case " $rules " in *" $(awk -F'\t' -v v="$vector" '$1==v {print $3}' "$V/expected.tsv") "*) ;;
        *) fail "$vector: the rule expected.tsv names is not in its refusal set '$rules'" ;;
    esac
    case $repaired in valid|unmeasured) ;; *) fail "$vector: unknown repair column '$repaired'" ;; esac
done <"$SETS"

recorded=$(grep -vc '^#' "$SETS" || true)
refused_count=$(awk -F'\t' '!/^#/ && $2=="refused" && ($1 ~ /^lock\// || $1 ~ /^upstream\//)' "$V/expected.tsv" | wc -l)
CHECKS=$((CHECKS + 1))
[ "$recorded" = "$refused_count" ] || fail "refusal-sets.tsv has $recorded rows for $refused_count refused lock vectors"

while IFS= read -r vector; do
    CHECKS=$((CHECKS + 1))
    listed_in_derivation=1
    for candidate in "${declared[@]}"; do
        [ "$candidate" = "$vector" ] && listed_in_derivation=0
    done
    [ "$listed_in_derivation" = 0 ] || fail "$vector declares no derivation in derived-from.tsv"
done < <(cd "$V" && find lock/refused upstream/refused -name '*.lock' | sort)

if [ "$FAIL" -gt 0 ]; then
    echo "tools/docs/verify-release-lock.sh: $FAIL FAILED, $((CHECKS - FAIL)) passed" >&2
    exit 1
fi
echo "tools/docs/verify-release-lock.sh: $CHECKS/$CHECKS PASS"
