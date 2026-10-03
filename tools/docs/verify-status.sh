#!/usr/bin/env bash
# Asserts that every truth-status line under docs/start/, docs/operate/,
# docs/integrate/, docs/hardware/, docs/security/, docs/releases/ and
# docs/website/ follows the grammar in docs/contributing.md and cites
# evidence that exists. Read-only: it opens files and prints, changes nothing.
#
#   bash tools/docs/verify-status.sh          (or: make docs-verify)
#
# THE GRAMMAR (docs/contributing.md section 3, normative):
#
#   > status: <s>
#   > status: <s> — evidence: `ref`, `ref`
#
# with <s> one of shipped | board-dependent | proposed | unsupported, the
# separator an em dash with spaces, and each reference in backticks.
#
# WHAT IS ENFORCED, per the contract's evidence rules:
#   - every `> status:` line must parse against the grammar above;
#   - every cited ref must exist: a repository path (file or directory), or
#     `make <target>` where <target> is defined in the top-level Makefile --
#     a dead evidence reference is a broken claim, not a cosmetic defect;
#   - shipped, board-dependent and proposed REQUIRE evidence; for proposed it
#     is the design that labels the work not implemented, or the record of the
#     repository that will implement it (`<repository>:docs/...`). This
#     repository keeps no task or plan records since 2026-10-01;
#   - unsupported carries NO evidence -- the absence is the claim.
#
# And one meta-assertion: a scanned tree with ZERO status lines fails. The
# taxonomy is the core of the user-doc contract; a tree that stopped carrying
# status lines has not become perfect, it has escaped the gate, and a check
# over an empty set reports green without having checked anything.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

FAIL=0
CHECKS=0

fail() { echo "  FAIL $*" >&2; FAIL=$((FAIL + 1)); }
ok()   { CHECKS=$((CHECKS + 1)); }

# `make <target>` evidence: the target must be defined in the top-level
# Makefile. A definition line is `targets...: [prereqs]` with the cited name
# among the colon-left words; `=` lines are variable assignments, not rules.
make_target_exists() {
    awk -v t="$1" -F: '
        /^[A-Za-z0-9._][^:=]*:/ {
            n = split($1, a, /[ \t]+/)
            for (i = 1; i <= n; i++) if (a[i] == t) found = 1
        }
        END { exit found ? 0 : 1 }
    ' Makefile
}

ref_exists() {
    case "$1" in
        "make "*) make_target_exists "${1#make }" ;;
        *)        [ -e "$1" ] ;;
    esac
}

# A `> status:` line inside a fenced block is the GRAMMAR SPECIMEN in
# contributing.md teaching what the four statuses look like, not a claim about
# the product. Asserting it would require the illustrative `proposed` example
# to name a record that stays open forever, and a gate that fails on an example
# teaching the format is reporting prose as a defect. Fences are
# tracked, not stripped, so a real status line is still read anywhere else.
status_lines() {
    awk '
        /^[[:space:]]*```/ { fence = !fence; next }
        !fence && /^> status:/ { print }
    ' "$1"
}

check_status_line() {
    local file=$1 line=$2 status evidence refs_ok ref
    local rest=${line#> status: }

    if [[ $rest == *" — evidence: "* ]]; then
        status=${rest%% — evidence: *}
        evidence=${rest#* — evidence: }
    else
        status=$rest
        evidence=""
    fi

    case "$status" in
        shipped|board-dependent|proposed|unsupported) ;;
        *) fail "$file: does not parse -- '$line'"; return ;;
    esac

    if [ -n "$evidence" ] && ! [[ $evidence =~ ^\`[^\`]+\`(,\ \`[^\`]+\`)*$ ]]; then
        fail "$file: evidence list does not parse -- '$line'"
        return
    fi
    ok

    if [ "$status" = unsupported ]; then
        if [ -n "$evidence" ]; then
            fail "$file: unsupported carries no evidence, the absence is the claim -- '$line'"
        else
            ok
        fi
        return
    fi

    if [ -z "$evidence" ]; then
        case "$status" in
            shipped|board-dependent|proposed)
                fail "$file: $status requires evidence -- '$line'"; return ;;
        esac
    fi

    refs_ok=1
    while IFS= read -r ref; do
        ref=${ref#\`}; ref=${ref%\`}
        # A citation into another Mica OS repository (`<repository>:<path>` or
        # `<repository>:make <target>`): the code lives there, not here, so the
        # reference is accepted by shape; that repository's own gates prove it.
        if [[ $ref =~ ^(mica-build|mica-build-env|mica-build-tools|mica-debian|mica-boot|mica-boards|mica-core|mica-deploy|mica-podman|mica-system|mica-system-base):.+$ ]]; then
            ok; continue
        fi
        if ref_exists "$ref"; then
            ok
        else
            refs_ok=0
            fail "$file: evidence '$ref' does not exist -- '$line'"
        fi
    done < <(grep -oE '`[^`]+`' <<<"$evidence" || true)

    if [ "$refs_ok" -eq 1 ]; then
        ok
    fi
}

TREES=(docs/start docs/operate docs/integrate docs/hardware docs/security docs/releases docs/website)
echo "tools/docs/verify-status.sh: truth-status lines under ${TREES[*]}"

for tree in "${TREES[@]}"; do
    tree_lines=0
    for f in "$tree"/*.md; do
        # `|| true`: a page with no status lines is legal; the floor is per tree.
        while IFS= read -r line; do
            tree_lines=$((tree_lines + 1))
            check_status_line "$f" "$line"
        done < <(status_lines "$f")
    done
    if [ "$tree_lines" -eq 0 ]; then
        fail "$tree/ contains zero status lines; the taxonomy gate would pass vacuously"
    else
        ok
    fi
done

# --- verdict ---------------------------------------------------------------
if [ "$FAIL" -ne 0 ]; then
    echo "tools/docs/verify-status.sh: $FAIL FAILED, $CHECKS passed" >&2
    exit 1
fi
echo "tools/docs/verify-status.sh: $CHECKS/$CHECKS PASS"
