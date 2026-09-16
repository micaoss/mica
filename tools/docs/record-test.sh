#!/usr/bin/env bash
# Proves tools/docs/record.sh refuses the cases it exists for, in a throw-away
# clone of this repository with a local "remote", so nothing here is touched
# and nothing is pushed anywhere real.
#
#   bash tools/docs/record-test.sh          (or: make docs-verify-test)
#
# THE CASES, each the shape of a real defect:
#   - a failing edit script must not produce a commit (5f1acfe);
#   - a named path that did not change must not produce a commit (41605d0);
#   - a change that breaks `make docs-verify` must not produce a commit;
#   - an already-staged change must not ride along;
#   - a message with an attribution line is refused;
#   - the happy path commits exactly the named paths and pushes once.
set -euo pipefail

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

FAIL=0
CHECKS=0
ok()   { CHECKS=$((CHECKS + 1)); echo "  PASS $*"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL $*" >&2; }

echo "tools/docs/record-test.sh: the gated records sequence"

# A bare "remote" plus a clone of the working tree's HEAD.
git init -q --bare "$WORK/remote.git"
git clone -q "$REPO" "$WORK/clone"
cd "$WORK/clone"
git remote set-url origin "$WORK/remote.git"
git branch -M main
# Test the script as it is in the working tree, not as it was last committed.
cp "$REPO/tools/docs/record.sh" tools/docs/record.sh
git add tools/docs/record.sh
# Only a working-tree edit needs a fixture commit; normally the clone already
# carries the committed script and there is nothing to commit here.
git diff --cached --quiet \
    || git -c user.name=test -c user.email=test@example.invalid \
           commit -q -m 'fixture: the script under test'
git push -q origin main
BASE=$(git rev-parse HEAD)

printf 'A records change\n' > "$WORK/message"

run() { bash tools/docs/record.sh "$@" >"$WORK/out" 2>&1; }
committed() { [ "$(git rev-parse HEAD)" != "$BASE" ]; }
reset_tree() { git reset -q --hard "$BASE"; git clean -qfd; }

# 1. a failing edit script
printf 'exit 3\n' > "$WORK/edit.sh"
if run --edit "$WORK/edit.sh" --message "$WORK/message" -- docs/changelog.md; then
    fail "a failing edit script was accepted"
elif committed; then
    fail "a failing edit script still produced a commit"
else
    ok "a failing edit script produces no commit"
fi
reset_tree

# 2. a named path that did not change
printf 'true\n' > "$WORK/edit.sh"
if run --edit "$WORK/edit.sh" --message "$WORK/message" -- docs/changelog.md; then
    fail "an unchanged path was accepted"
elif committed; then
    fail "an unchanged path still produced a commit"
else
    grep -q "did not change" "$WORK/out" \
        && ok "an unchanged path is refused by name" \
        || fail "an unchanged path was refused, but not with the expected reason"
fi
reset_tree

# 3. a change that breaks the gates: a link with no target
printf 'printf "\\nSee [the ghost](ghost.md).\\n" >> docs/changelog.md\n' > "$WORK/edit.sh"
if run --edit "$WORK/edit.sh" --message "$WORK/message" -- docs/changelog.md; then
    fail "a change that breaks docs-verify was accepted"
elif committed; then
    fail "a change that breaks docs-verify still produced a commit"
else
    ok "a change that breaks docs-verify produces no commit"
fi
reset_tree

# 4. something already staged
printf 'x\n' >> docs/changelog.md
git add docs/changelog.md
printf 'true\n' > "$WORK/edit.sh"
if run --edit "$WORK/edit.sh" --message "$WORK/message" -- docs/changelog.md; then
    fail "a pre-staged change was accepted"
else
    grep -q "already staged" "$WORK/out" \
        && ok "a pre-staged change is refused" \
        || fail "a pre-staged change was refused, but not with the expected reason"
fi
reset_tree

# 5. an attribution line in the message
printf 'A records change\n\nCo-Authored-By: someone <x@y>\n' > "$WORK/attributed"
printf 'printf "\\n" >> docs/changelog.md\n' > "$WORK/edit.sh"
if run --edit "$WORK/edit.sh" --message "$WORK/attributed" -- docs/changelog.md; then
    fail "an attributed message was accepted"
else
    grep -q "attribution" "$WORK/out" \
        && ok "an attributed message is refused" \
        || fail "an attributed message was refused, but not with the expected reason"
fi
reset_tree

# 6. the happy path: one commit, the named path only, pushed once
cat > "$WORK/edit.sh" <<'EDIT'
printf '\n## 1970-01-01 00:00 [test]\n\nA fixture entry.\n' >> docs/changelog.md
printf 'untracked\n' > docs/plan/record-test-leftover.md
EDIT
if run --edit "$WORK/edit.sh" --message "$WORK/message" -- docs/changelog.md; then
    if ! committed; then
        fail "the happy path produced no commit"
    elif [ "$(git show --name-only --format= HEAD)" != "docs/changelog.md" ]; then
        fail "the commit carries paths that were not named: $(git show --name-only --format= HEAD | tr '\n' ' ')"
    elif [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
        fail "the commit was not pushed"
    else
        ok "the happy path commits exactly the named path and pushes"
    fi
else
    fail "the happy path was refused: $(tail -2 "$WORK/out" | tr '\n' ' ')"
fi

if [ "$FAIL" -ne 0 ]; then
    echo "tools/docs/record-test.sh: $FAIL FAILED, $CHECKS passed" >&2
    exit 1
fi
echo "tools/docs/record-test.sh: $CHECKS/$CHECKS PASS"
