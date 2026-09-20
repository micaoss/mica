#!/usr/bin/env bash
# Asserts that the claims these records make about ANOTHER repository's
# standing state still hold, by reading that repository. Read-only: it fetches
# and prints, and changes nothing.
#
#   bash tools/docs/verify-world.sh          (or: make docs-verify-world)
#
# WHY IT IS NOT PART OF `make docs-verify`. That gate is offline, file-only and
# deterministic, and a records change must never be blocked by GitHub being
# slow or by another repository being mid-edit. This one needs the network and
# a `gh` that can read public contents, so it runs as its own CI job.
#
# WHAT IT EXISTS TO STOP. On 2026-09-20 two claims in docs/design/release-
# artifacts.md -- "s905x5m is not a release target" and an index tag in the
# slash form -- were found while reading the page for something else. Both were
# mechanically checkable against artefacts that already existed. "Found
# incidentally" was a description of the tooling, not a property of stale
# documentation, and the next two would have been found the same way, which is
# to say by luck.
#
# ONLY STANDING CLAIMS. docs/world-claims.tsv carries claims that are true of
# the world until it moves, never dated measurements: re-checking "427
# snapshots on 2026-09-20" against today would turn a record of a moment into a
# false alarm every morning.
#
# THE READER IS INJECTABLE so the negative tests need no network:
# MICA_WORLD_READER names a command called as `<cmd> file <repo> <path>` or
# `<cmd> tags <repo>`. Unset, the reader is `gh`.
#
# NO SILENT PASS. Without a usable reader this exits 2 and says so: a check
# that cannot reach its subject must not look like a check that found nothing
# wrong.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLAIMS="${MICA_WORLD_CLAIMS:-${ROOT}/docs/world-claims.tsv}"
READER="${MICA_WORLD_READER:-}"
NAME="tools/docs/verify-world.sh"

[ -f "$CLAIMS" ] || { echo "${NAME}: no claims file at ${CLAIMS}" >&2; exit 2; }

if [ -z "$READER" ] && ! command -v gh >/dev/null 2>&1; then
    echo "${NAME}: no gh and no MICA_WORLD_READER; cannot reach the world" >&2
    exit 2
fi

read_file() { # <repo> <path>
    if [ -n "$READER" ]; then "$READER" file "$1" "$2"; else
        gh api "repos/$1/contents/$2" --jq .content | base64 -d
    fi
}

read_tags() { # <repo>
    if [ -n "$READER" ]; then "$READER" tags "$1"; else
        gh release list --repo "$1" --limit 100 --json tagName --jq '.[].tagName'
    fi
}

total=0
drift=0
while IFS=$'\t' read -r claim kind locator expected stated; do
    case "$claim" in ''|'#'*) continue ;; esac
    [ -n "${stated:-}" ] || { echo "${NAME}: ${claim}: row has too few columns" >&2; exit 2; }
    total=$((total + 1))
    repo="${locator%%:*}"
    rest="${locator#*:}"
    verdict=DRIFT
    case "$kind" in
        line|no-line)
            body="$(read_file "$repo" "$rest")" || { echo "${NAME}: ${claim}: cannot read ${locator}" >&2; exit 2; }
            found=no
            while IFS= read -r line; do
                [ "$line" = "$expected" ] && found=yes
            done <<<"$body"
            if [ "$kind" = line ] && [ "$found" = yes ]; then verdict=OK; fi
            if [ "$kind" = no-line ] && [ "$found" = no ]; then verdict=OK; fi
            ;;
        newest-tag)
            newest=""
            while IFS= read -r tag; do
                case "$tag" in
                    "${rest}."*|"${rest}/"*)
                        stamp="${tag#"${rest}"}"
                        stamp="${stamp#?}"
                        [ "$stamp" \> "${newest#*|}" ] && newest="${tag}|${stamp}"
                        ;;
                esac
            done < <(read_tags "$repo")
            [ -n "$newest" ] || { echo "${NAME}: ${claim}: no tag of ${repo} begins ${rest}" >&2; exit 2; }
            newest="${newest%%|*}"
            if [[ "$newest" =~ $expected ]]; then verdict=OK; fi
            expected="${expected} (newest: ${newest})"
            ;;
        *)
            echo "${NAME}: ${claim}: unknown kind '${kind}'" >&2; exit 2 ;;
    esac
    printf '%s: %-26s %-11s %s -- stated in %s\n' "$NAME" "$claim" "$verdict" "$expected" "$stated"
    [ "$verdict" = OK ] || drift=$((drift + 1))
done <"$CLAIMS"

[ "$total" -gt 0 ] || { echo "${NAME}: no claims read; a check over an empty set reports green without having checked anything" >&2; exit 2; }

if [ "$drift" -gt 0 ]; then
    echo "${NAME}: ${drift} of ${total} claims no longer hold; the records say something the world does not" >&2
    exit 1
fi
echo "${NAME}: ${total}/${total} claims still hold"
