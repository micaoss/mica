#!/usr/bin/env bash
# Proves tools/docs/shell-lint.sh fails on fixtures where its facts are false,
# and passes a clean one. Read-only over the repository: every fixture is
# written into a temporary tree.
#
#   bash tools/docs/shell-lint-test.sh          (or: make docs-verify-test)
set -euo pipefail

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

FAIL=0
CHECKS=0
ok()   { CHECKS=$((CHECKS + 1)); echo "  PASS $*"; }
bad()  { FAIL=$((FAIL + 1)); echo "  FAIL $*" >&2; }

echo "tools/docs/shell-lint-test.sh: the shell hygiene lint"

case_dir() {
    rm -rf "$WORK/tools"
    mkdir -p "$WORK/tools"
    printf '#!/usr/bin/env bash\nset -euo pipefail\n%s\n' "$1" > "$WORK/tools/case.sh"
}

# The lint resolves its tree relative to the repository, so run it from there
# with the fixture tree passed in.
run() { (cd "$REPO" && bash tools/docs/shell-lint.sh "$WORK/tools") >"$WORK/out" 2>&1; }

case_dir 'printf "a\nb\n" | grep -qxF a'   # shell-lint: fixture
if run; then bad "grep -q on the right of a pipe was accepted"
else grep -q 'case.sh' "$WORK/out" && ok "grep -q on the right of a pipe is refused" \
     || bad "refused, but without naming the script"; fi

case_dir 'seq 100 | head -n1'   # shell-lint: fixture
if run; then bad "head on the right of a pipe was accepted"; else ok "head on the right of a pipe is refused"; fi

case_dir 'seq 100 | grep -m 1 7'   # shell-lint: fixture
if run; then bad "grep -m on the right of a pipe was accepted"; else ok "grep -m on the right of a pipe is refused"; fi

case_dir 'seq 100 | sed -n 1q'   # shell-lint: fixture
if run; then bad "sed Nq on the right of a pipe was accepted"; else ok "sed Nq on the right of a pipe is refused"; fi

# A script without the shell options.
rm -rf "$WORK/tools"; mkdir -p "$WORK/tools"
printf '#!/usr/bin/env bash\necho hi\n' > "$WORK/tools/case.sh"
if run; then bad "a script without set -euo pipefail was accepted"
else grep -q 'does not set' "$WORK/out" && ok "a script without set -euo pipefail is refused" \
     || bad "refused, but not for the shell options"; fi

# The rule named in a comment is prose, not a finding.
case_dir '# never write: seq 100 | head -n1   # shell-lint: fixture
awk "NR == 1" <(seq 100) >/dev/null'
if run; then ok "the rule quoted in a comment is not a finding"; else bad "a comment was reported as a finding"; fi

# A clean script, and the empty tree that must not pass vacuously.
case_dir 'lines=$(seq 100); first=${lines%%$'"'"'\n'"'"'*}; [ -n "$first" ]'   # shell-lint: fixture
if run; then ok "a clean script passes"; else bad "a clean script was refused: $(tail -1 "$WORK/out")"; fi

rm -rf "$WORK/tools"; mkdir -p "$WORK/tools"
if run; then bad "an empty tree passed vacuously"
else grep -q 'would pass by finding nothing' "$WORK/out" && ok "an empty tree is refused" \
     || bad "an empty tree failed, but not for being empty"; fi

if [ "$FAIL" -ne 0 ]; then
    echo "tools/docs/shell-lint-test.sh: $FAIL FAILED, $CHECKS passed" >&2
    exit 1
fi
echo "tools/docs/shell-lint-test.sh: $CHECKS/$CHECKS PASS"
