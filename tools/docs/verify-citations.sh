#!/usr/bin/env bash
# Asserts that every `<repository>:<path>` citation in the living documents
# names a path that exists on that repository's main branch. Read-only.
#
#   bash tools/docs/verify-citations.sh          (or: make docs-verify-world)
#
# WHY. The documents cite code in the other repositories by path, and those
# repositories move their files: on 2026-10-01 105 citations no longer
# resolved, 85 of them because mica-core's crates moved under `crates/`.
# `make docs-verify` checks only links inside this repository, so nothing
# noticed.
#
# HOW. One tree listing per cited repository (`gh api .../git/trees/main
# ?recursive=1`), then every citation is looked up in it. A path ending in `/`
# or naming a directory resolves when any file lies under it; `*` is a glob.
# `<repository>:make <target>` and a placeholder (`<...>`) are skipped; `file:line`
# and `file::symbol` name the file.
#
# THE READER IS INJECTABLE so the negative tests need no network:
# MICA_CITE_TREES names a directory holding `<repository>.txt`, one path per
# line. Unset, the trees come from `gh`; without a usable `gh` this exits 2.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCS="${MICA_CITE_DOCS:-$ROOT}"
REPOS='mica-core|mica-build|mica-build-env|mica-build-tools|mica-system-base|mica-podman'
TREES="$(mktemp -d)"
trap 'rm -rf "${TREES}"' EXIT

files=()
while IFS= read -r f; do files+=("$f"); done < <(
    cd "$DOCS" && { ls README.md README.zh-CN.md 2>/dev/null || true; find docs -name '*.md'; } | sort)

citations="$(cd "$DOCS" && grep -ohE "\`(${REPOS}):[^\` ]+\`" "${files[@]}" | tr -d '\`' | sort -u || true)"
echo "tools/docs/verify-citations.sh: $(printf '%s\n' "$citations" | grep -c . || true) distinct citation(s) in ${#files[@]} file(s)"

tree() {
    local repo="$1" out="${TREES}/$1.txt"
    [ -f "$out" ] && { cat "$out"; return; }
    if [ -n "${MICA_CITE_TREES:-}" ]; then
        cp "${MICA_CITE_TREES}/${repo}.txt" "$out" 2>/dev/null || : >"$out"
    else
        command -v gh >/dev/null || { echo "tools/docs/verify-citations.sh: no gh to read ${repo}" >&2; exit 2; }
        gh api "repos/micaoss/${repo}/git/trees/main?recursive=1" --jq '.tree[].path' >"$out" \
            || { echo "tools/docs/verify-citations.sh: cannot read the tree of ${repo}" >&2; exit 2; }
    fi
    cat "$out"
}

FAIL=0 CHECKS=0
while IFS= read -r c; do
    [ -n "$c" ] || continue
    repo="${c%%:*}" path="${c#*:}"
    case "$path" in make*|*'<'*|*'...'*) continue ;; esac   # a target or a placeholder, not a path
    path="${path%%::*}"                                         # file::symbol names the file
    [[ "$path" =~ ^(.*):[0-9]+$ ]] && path="${BASH_REMATCH[1]}"  # file:line names the file
    CHECKS=$((CHECKS + 1))
    path="${path%/}"
    paths="$(tree "$repo")"
    found=0
    if [[ "$path" == *'*'* ]]; then
        while IFS= read -r p; do [[ "$p" == $path ]] && { found=1; break; }; done <<<"$paths"
    elif grep -qxF -- "$path" <<<"$paths"; then
        found=1
    elif grep -qF -- "${path}/" <<<"$paths"; then
        found=1
    fi
    [ "$found" -eq 1 ] && continue
    where="$(cd "$DOCS" && grep -lF "\`${c}\`" "${files[@]}" || true)"
    where="$(sed -n '1,3p' <<<"$where" | tr '\n' ' ')"
    echo "  FAIL ${c} does not exist -- cited in ${where}" >&2
    FAIL=$((FAIL + 1))
done <<<"$citations"

if [ "$FAIL" -gt 0 ]; then
    echo "tools/docs/verify-citations.sh: ${FAIL} FAILED, $((CHECKS - FAIL)) passed" >&2
    exit 1
fi
echo "tools/docs/verify-citations.sh: ${CHECKS}/${CHECKS} PASS"
