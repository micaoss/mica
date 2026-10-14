#!/usr/bin/env bash
# One gated sequence for a records change: apply an edit, prove the docs gates,
# stage exactly the paths the change is about, commit and push.
#
#   bash tools/docs/record.sh --edit <script> --message <file> -- <path>...
#   bash tools/docs/record.sh --message <file> -- <path>...        (edits already made)
#
# It runs under `set -euo pipefail`, so any failing step stops the sequence
# before the commit exists.
#
# WHAT IT ASSERTS, in order:
#   1. the working tree has nothing staged already (an unrelated change must
#      not ride along in this commit);
#   2. the edit script exits 0 -- `.py` runs under python3, anything else
#      under bash;
#   3. EVERY named path actually changed, so a message cannot claim an edit
#      that did not happen;
#   4. `make docs-verify` passes over the edited tree, and `make
#      docs-verify-test` as well when a named path is under tools/;
#   5. only the named paths are staged (never `git add -A`: other sessions
#      share this checkout);
#   6. the commit message file is non-empty and carries no attribution line.
# Then it commits, and pushes -- rebasing once onto origin/main and re-running
# the gate if another session pushed first.
#
# THE GATE RUNS AGAIN AFTER THE REBASE. A gate run before a rebase validated a
# tree that is not the tree being pushed: the rebase replays the commit onto
# someone else's, and the result is a tree nothing has checked.
#
# THIS SCRIPT CANNOT EDIT ITSELF THROUGH `--edit`. bash reads a script
# incrementally by byte offset, so a rewrite of this file in place is picked
# up mid-run, and depending on where the bytes moved the run either dies in
# the middle of a line or silently continues as a script that is part old and
# part new. To change this file, apply the edit first and run the `edits
# already made` form, which rewrites nothing during the run.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

EDIT=""
MESSAGE=""
PATHS=()

die() { echo "record.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --edit)    EDIT=${2:-}; shift 2 ;;
        --message) MESSAGE=${2:-}; shift 2 ;;
        --)        shift; PATHS=("$@"); break ;;
        *)         die "unknown argument '$1'" ;;
    esac
done

[ -n "$MESSAGE" ] || die "--message <file> is required"
[ -f "$MESSAGE" ] || die "message file '$MESSAGE' does not exist"
[ -s "$MESSAGE" ] || die "message file '$MESSAGE' is empty"
[ "${#PATHS[@]}" -gt 0 ] || die "name the paths this change is about after --"
if grep -qiE '^(co-authored-by|signed-off-by|generated with)' "$MESSAGE"; then
    die "the message carries an attribution line; records commits carry none"
fi

# 1. nothing staged already
git diff --cached --quiet || die "something is already staged; commit or reset it first"

# 2. the edit
if [ -n "$EDIT" ]; then
    [ -f "$EDIT" ] || die "edit script '$EDIT' does not exist"
    case "$EDIT" in
        *.py) python3 "$EDIT" ;;
        *)    bash "$EDIT" ;;
    esac
fi

# 3. every named path changed
for p in "${PATHS[@]}"; do
    [ -n "$(git status --porcelain -- "$p")" ] \
        || die "'$p' did not change; the commit would claim an edit that never landed"
done

# 4. the gates. A change under tools/ also runs the gate tests, because such a
# change can break the gate that proves every other commit. A records change
# that touches no tooling cannot, and does not pay for them.
make docs-verify
for p in "${PATHS[@]}"; do
    case "$p" in
        tools|tools/*)
            echo "record.sh: tools/ touched, running the gate tests as well" >&2
            make docs-verify-test
            break ;;
    esac
done

# 5. stage exactly what was named
git add -- "${PATHS[@]}"
git diff --cached --quiet && die "nothing staged after git add; check the paths"

# 6. commit, then push. On a rejection: rebase, GATE AGAIN, push. The second
# `make docs-verify` is over the rebased tree, which is the one that reaches
# origin.
git commit -q -F "$MESSAGE"
if ! git push -q origin main 2>/dev/null; then
    echo "record.sh: push rejected, rebasing onto origin/main and re-running the gate" >&2
    git fetch -q origin main
    git rebase -q origin/main
    make docs-verify
    git push -q origin main
fi

echo "record.sh: pushed $(git rev-parse --short HEAD) -- $(head -1 "$MESSAGE")"
