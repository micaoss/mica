#!/usr/bin/env bash
# Negative tests for tools/docs/verify-release-lock.sh: each refusal is driven
# against a copy of the vectors in which its fact is false, and is required to
# fail with ITS OWN message.
#
#   bash tools/docs/verify-release-lock-test.sh     (or: make docs-verify-test)
#
# WHY THIS EXISTS, WRITTEN THE DAY IT WAS MISSED. That gate carried 355
# assertions for six days with no negative test of any kind, while every commit
# report here quoted "355/355 PASS" as evidence. It had been bite-tested twice
# by hand -- mutate a real vector, watch it refuse, restore from /tmp -- which
# proves the gate at that moment and leaves nothing that runs. NEVER QUOTE A
# CHECK YOU HAVE NOT SEEN FAIL, and "seen" has to mean something a later reader
# can re-run.
#
# NO NETWORK AND NO WRITES OUTSIDE THE COPY: the gate reads MICA_VECTORS, so
# every case here runs against a temporary tree and the real vectors are never
# touched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GATE="${ROOT}/tools/docs/verify-release-lock.sh"
SRC="${ROOT}/docs/design/release-lock/vectors"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

pass=0
fail=0
check() { # <name> <expected exit> <expected message fragment>
    set +e
    ( cd "${ROOT}" && MICA_VECTORS="${WORK}/vectors" bash "${GATE}" ) >"${WORK}/out" 2>&1
    got=$?
    set -e
    if [ "$got" -eq "$2" ] && grep -qF "$3" "${WORK}/out"; then
        pass=$((pass + 1))
    else
        fail=$((fail + 1))
        echo "FAIL ${1}: exit ${got} (expected ${2}), message '${3}' not found"
        sed 's/^/    /' "${WORK}/out"
    fi
}

fresh() { rm -rf "${WORK}/vectors"; cp -r "${SRC}" "${WORK}/vectors"; }

# The positive control first: an untouched copy must pass, or every refusal
# below would be indistinguishable from a broken copy.
fresh
check "an untouched copy passes" 0 "PASS"

# A vector whose recorded result is not what the checker returns.
fresh
sed -i '0,/\tvalid\t/s//\trefused\theader\t/' "${WORK}/vectors/expected.tsv"
check "a wrong expected result is refused" 1 "expected 'refused header'"

# A vector on disk that expected.tsv does not list: the set equality that a
# suite walking its own list cannot do for itself.
fresh
# `-print -quit` rather than `| head -1`: an early-exiting reader on the right
# of a pipe dies of SIGPIPE under pipefail, which this repository's shell lint
# refuses -- and refused this file on its first run.
any_lock="$(find "${WORK}/vectors/lock" -name '*.lock' -print -quit)"
cp "${any_lock}" "${WORK}/vectors/lock/unlisted.lock"
check "an unlisted vector on disk is refused" 1 "is not listed in expected.tsv"

# Nothing to check at all: a gate over an empty set reports green having
# checked nothing, so it must refuse instead.
fresh
printf '# only a comment\n' >"${WORK}/vectors/expected.tsv"
check "an expected.tsv with no vectors is refused" 1 "lists no vectors"

# The derivation and refusal-set records are inputs to this gate, and an empty
# one must not read as "nothing to compare".
fresh
: >"${WORK}/vectors/derived-from.tsv"
check "an empty derived-from.tsv is refused" 1 "is missing or empty"

fresh
: >"${WORK}/vectors/refusal-sets.tsv"
check "an empty refusal-sets.tsv is refused" 1 "is missing or empty"

# A recorded refusal set that no longer matches what the collect mode reports.
# The mutation is a rule NO vector names: the first draft of this case wrote
# `header` over the first `set` row, whose rule already WAS `header`, so the
# fixture was a no-op and the gate passed -- a test that does not reach the
# seam, in the test written to prove the gate reaches it.
fresh
awk -F'\t' 'BEGIN{OFS="\t"} !/^#/ && $2=="set" && !done {$3="not-a-rule"; done=1} {print}' \
    "${WORK}/vectors/refusal-sets.tsv" >"${WORK}/sets" && mv "${WORK}/sets" "${WORK}/vectors/refusal-sets.tsv"
check "a wrong recorded refusal set is refused" 1 "expected rules 'not-a-rule'"

# The fourth column's vocabulary: a column that only ever says `valid` records
# nothing, so `unmeasured` is legal and anything else refuses.
fresh
awk -F'\t' 'BEGIN{OFS="\t"} !/^#/ && !done {$4="probably"; done=1} {print}' \
    "${WORK}/vectors/refusal-sets.tsv" >"${WORK}/sets" && mv "${WORK}/sets" "${WORK}/vectors/refusal-sets.tsv"
check "an unknown repair column is refused" 1 "unknown repair column"

echo "tools/docs/verify-release-lock-test.sh: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
