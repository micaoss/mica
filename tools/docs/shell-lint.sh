#!/usr/bin/env bash
# Asserts the shell hygiene rules this repository's scripts are held to.
# Read-only: it opens files and prints, and changes nothing.
#
#   bash tools/docs/shell-lint.sh          (or: make docs-verify-test)
#
# THE RULES:
#
#   1. Every script under tools/ sets `set -euo pipefail`. Without it a failing
#      step in the middle of a sequence is invisible.
#
#   2. No early-exiting reader on the right of a pipe. Under `pipefail` a
#      consumer that stops reading -- `grep -q`, `grep -m N`, `head`,
#      `sed -n '<n>q'`, `read` -- lets the still-writing producer die of
#      SIGPIPE, and the pipeline then reports failure for input that was
#      perfectly good. It fires only when the producer is slow or the input is
#      long, so it survives every small-input test.
#
#      This is not theory here: `printf '%s\n' "${listed[@]}" | grep -qxF` in
#      verify-release-lock.sh reported a valid vector as unlisted at random
#      until 3fd60fa replaced it with a shell loop. `mica-podman` found the
#      same class in three `| head -n1` readers (its 6c63a7a).
#
#      The fix is to read everything and pick afterwards: a shell loop over an
#      array, `${var%%$'\n'*}` for a first line, or `awk` (which reads to EOF).
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

TREE=${1:-tools}
FAIL=0
CHECKS=0

fail() { echo "  FAIL $*" >&2; FAIL=$((FAIL + 1)); }
ok()   { CHECKS=$((CHECKS + 1)); }

mapfile -t scripts < <(find "$TREE" -name '*.sh' -type f | sort)
echo "tools/docs/shell-lint.sh: shell hygiene over ${#scripts[@]} script(s) under $TREE/"

# A pipeline stage whose command stops reading before EOF. Comments are
# stripped first: the rule is explained in prose in several of these files.
EARLY='\|[[:space:]]*(head([[:space:]]|$)|grep([^|]*[[:space:]]-[a-zA-Z]*[qm][a-zA-Z]*([[:space:]]|$)|[^|]*[[:space:]]--(quiet|silent|max-count))|sed[^|]*[[:space:]][0-9]+q|read([[:space:]]|$))'

# The same rule as a bash ERE, for the matching below: this lint must not
# break its own rule by piping into `grep -q`.
EARLY_BASH=$EARLY

for f in "${scripts[@]}"; do
    if grep -qxF 'set -euo pipefail' "$f"; then
        ok
    else
        fail "$f does not set -euo pipefail"
    fi

    # A line may opt out with the marker below when it *quotes* the shape as a
    # fixture or an example rather than running it; the lint's own test does.
    n=0
    while IFS= read -r line; do
        n=$((n + 1))
        case "$line" in *'shell-lint: fixture'*) continue ;; esac
        stripped=${line%%#*}
        if [[ $stripped =~ $EARLY_BASH ]]; then
            fail "$f:$n: an early-exiting reader on the right of a pipe -- $(printf '%s' "$stripped" | sed 's/^[[:space:]]*//')"
        fi
    done < "$f"
    ok
done

if [ "${#scripts[@]}" -eq 0 ]; then
    fail "no scripts found under $TREE/; this lint would pass by finding nothing"
fi

if [ "$FAIL" -ne 0 ]; then
    echo "tools/docs/shell-lint.sh: $FAIL FAILED, $CHECKS passed" >&2
    exit 1
fi
echo "tools/docs/shell-lint.sh: $CHECKS/$CHECKS PASS"
