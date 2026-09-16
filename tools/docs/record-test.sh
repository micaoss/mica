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

# The fixture is a repository this test builds: the tracked tree of HEAD,
# committed once here, with its own bare remote. It is deliberately NOT a clone
# of the repository under test -- actions/checkout clones with `fetch-depth: 1`,
# and git refuses to push a shallow history into a fresh remote ("shallow
# update not allowed"), so a clone-based fixture passed on a workstation and
# failed in CI. `git archive HEAD` reads a shallow repository perfectly well:
# it needs one commit, not the history behind it.
git init -q --bare "$WORK/remote.git"
mkdir -p "$WORK/clone"
git -C "$REPO" archive HEAD | tar -x -C "$WORK/clone"
# The script under test comes from the working tree, so an edit to it is proven
# before it is committed.
cp "$REPO/tools/docs/record.sh" "$WORK/clone/tools/docs/record.sh"
cd "$WORK/clone"
git init -q -b main
# The identity belongs to the fixture repository, not to this shell: record.sh
# commits inside it too, and a CI runner has no global git identity -- without
# this the happy path fails with "empty ident name" on the runner and passes on
# a workstation.
git config user.name test
git config user.email test@example.invalid
git add -A
git commit -q -m 'fixture: the tree under test'
git remote add origin "$WORK/remote.git"
# The invariant the CI failure of 2026-09-16 broke: the fixture must own a
# complete history, because git refuses to push a shallow one into a fresh
# remote. Asserting it here names the cause; the push would only say
# "shallow update not allowed".
if [ "$(git rev-parse --is-shallow-repository)" != false ]; then
    echo "  FAIL the fixture repository is shallow; it cannot be pushed" >&2
    exit 1
fi
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
