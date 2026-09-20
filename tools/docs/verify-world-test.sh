#!/usr/bin/env bash
# Negative tests for tools/docs/verify-world.sh: each refusal is driven against
# a fixture in which its fact is false, and is required to fail with ITS OWN
# message.
#
#   bash tools/docs/verify-world-test.sh          (or: make docs-verify-test)
#
# NO NETWORK. The verifier's reader is injectable (MICA_WORLD_READER), so a
# stub answers `file` and `tags` from the fixture. That is the whole reason the
# seam exists: a gate about the outside world whose tests need the outside
# world would be skipped on the first bad morning.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFIER="${HERE}/verify-world.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

cat >"${WORK}/reader" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case "$1" in
    file) case "$3" in
              boards/present/board.env) printf 'BOARD_RELEASE_TARGET=1\nBOARD_ARCH=amd64\n' ;;
              boards/absent/board.env)  printf 'BOARD_RELEASE_TARGET=0\n' ;;
              *) echo "stub: no such path $3" >&2; exit 1 ;;
          esac ;;
    tags) printf 'mica.20260920-0636\nmica/20260915-2242\ncx3576.20260920-0622\n' ;;
    list) case "$3" in
              verify/src) printf 'checks-firewall.ts\nchecks-root.ts\n' ;;
              *) echo "stub: no such directory $3" >&2; exit 1 ;;
          esac ;;
    *) echo "stub: unknown verb $1" >&2; exit 1 ;;
esac
STUB
chmod +x "${WORK}/reader"
export MICA_WORLD_READER="${WORK}/reader"

pass=0
fail=0
check() { # <name> <expected exit> <claims body>
    printf '%s\n' "$3" >"${WORK}/claims.tsv"
    set +e
    MICA_WORLD_CLAIMS="${WORK}/claims.tsv" bash "$VERIFIER" >"${WORK}/out" 2>&1
    got=$?
    set -e
    if [ "$got" -eq "$2" ]; then
        pass=$((pass + 1))
    else
        fail=$((fail + 1))
        echo "FAIL ${1}: exit ${got}, expected ${2}"
        sed 's/^/    /' "${WORK}/out"
    fi
}

tab=$'\t'
ok_row="release-target.present${tab}line${tab}r/x:boards/present/board.env${tab}BOARD_RELEASE_TARGET=1${tab}docs/boards/support-tiers.md"
bad_row="release-target.absent${tab}line${tab}r/x:boards/absent/board.env${tab}BOARD_RELEASE_TARGET=1${tab}docs/boards/support-tiers.md"
tag_ok="index-tag-form${tab}newest-tag${tab}r/x:mica${tab}^mica[.][0-9]{8}-[0-9]{4}\$${tab}docs/design/release-artifacts.md"
tag_bad="index-tag-form${tab}newest-tag${tab}r/x:mica${tab}^mica/${tab}docs/design/release-artifacts.md"
no_line_ok="no-such-line${tab}no-line${tab}r/x:boards/present/board.env${tab}BOARD_RELEASE_TARGET=0${tab}docs/boards/support-tiers.md"

no_path_ok="absent-check${tab}no-path${tab}r/x:verify/src/checks-kernel.ts${tab}absent${tab}docs/design/containers.md"
no_path_bad="present-check${tab}no-path${tab}r/x:verify/src/checks-root.ts${tab}absent${tab}docs/design/containers.md"
no_path_unreadable="ghost-dir${tab}no-path${tab}r/x:verify/ghost/x.ts${tab}absent${tab}docs/design/containers.md"
no_path_vocab="bad-expectation${tab}no-path${tab}r/x:verify/src/checks-kernel.ts${tab}yes${tab}docs/design/containers.md"

check "a claim the world still holds passes" 0 "$ok_row"
check "a claim the world no longer holds is refused" 1 "$bad_row"
check "no-line passes when the line is absent" 0 "$no_line_ok"
check "the newest tag is read across both separators" 0 "$tag_ok"
check "a wrong expectation about the newest tag is refused" 1 "$tag_bad"
check "a short row is refused rather than half-read" 2 "claim${tab}line${tab}r/x:boards/present/board.env"
check "an unknown kind is refused" 2 "c${tab}shape${tab}r/x:p${tab}v${tab}docs/x.md"
check "an unreadable source is refused, not skipped" 2 "c${tab}line${tab}r/x:boards/ghost/board.env${tab}v${tab}docs/x.md"
check "no-path passes when the file is not in its directory" 0 "$no_path_ok"
check "no-path is refused once the file appears" 1 "$no_path_bad"
check "no-path refuses when the directory itself cannot be listed" 2 "$no_path_unreadable"
check "no-path refuses an expectation other than 'absent'" 2 "$no_path_vocab"
check "an empty claims file is refused, not green" 2 "# only a comment"

echo "tools/docs/verify-world-test.sh: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
