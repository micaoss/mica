#!/usr/bin/env bash
# Negative tests for tools/docs/verify-reference.sh: a fixture core release and
# fixture pages that agree, then one drift at a time, each required to fail
# with ITS OWN message.
#
#   bash tools/docs/verify-reference-test.sh          (or: make docs-verify-test)
#
# NO NETWORK. The reader is injectable (MICA_REFERENCE_READER): a stub answers
# from the fixture core tree.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFIER="${HERE}/verify-reference.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

CORE="${WORK}/core"
mkdir -p "${CORE}/crates/mica-apid" "${CORE}/crates/micad/src/cli" "${CORE}/crates/micad-settings/src/model"

cat >"${CORE}/crates/mica-apid/openapi.json" <<'EOF'
{"paths": {"/api/v1/a": {"get": {}, "put": {}, "parameters": []}, "/api/v1/b": {"post": {}}}}
EOF

cat >"${CORE}/crates/micad/src/cli.rs" <<'EOF'
pub const VERBS: &[(&str, &str)] = &[
    ("status", "the device at a glance"),
    ("set", "write one setting"),
    ("help", "this list"),
];
pub const EXIT_DONE: i32 = 0;
pub const EXIT_FAILED: i32 = 1;
pub const EXIT_USAGE: i32 = 2;
pub const EXIT_UNREACHABLE: i32 = 3;
pub const EXIT_CREDENTIAL: i32 = 4;
const CREDENTIAL_CODES: &[&str] = &[
    "login_throttled",
];
const UNREACHABLE_ERRORS: &[&str] = &[
    "org.freedesktop.DBus.Error.NoReply",
];
EOF

cat >"${CORE}/crates/micad/src/cli/settings.rs" <<'EOF'
const KNOWN: &[(&str, Kind, bool)] = &[
    ("hostname", Kind::Text, false),
    ("time.timezone", Kind::Text, false),
];
#[test]
fn not_known() { let _ = ("logging.remote", Kind::Structure, true); }
EOF

cat >"${CORE}/crates/micad-settings/src/model.rs" <<'EOF'
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub hostname: String,
    #[serde(default)]
    pub time: TimeSettings,
}
EOF

cat >"${CORE}/crates/micad-settings/src/model/time.rs" <<'EOF'
#[serde(default, deny_unknown_fields, rename_all = "camelCase")]
pub struct TimeSettings {
    pub timezone: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub ntp_servers: Vec<String>,
    /// Retired: read and dropped.
    #[serde(skip_serializing)]
    pub old_zone: Retired,
}
EOF

cat >"${WORK}/reader" <<STUB
#!/usr/bin/env bash
set -euo pipefail
case "\$1" in
    file) cat "${CORE}/\$4" ;;
    list) ls "${CORE}/\$4" ;;
    *) echo "stub: unknown verb \$1" >&2; exit 1 ;;
esac
STUB
chmod +x "${WORK}/reader"
export MICA_REFERENCE_READER="${WORK}/reader"
echo "r1" >"${WORK}/pin"
export MICA_REFERENCE_PIN="${WORK}/pin"

write_pages() { # <docs root>
    local dir
    for dir in "$1/reference" "$1/zh/reference"; do
        mkdir -p "$dir"
        cat >"${dir}/http-api.md" <<'EOF'
# HTTP API routes

2 paths and 3 operations, at release r1.

## Routes

| Method | Path | What | Success |
|---|---|---|---|
| GET | `/api/v1/a` | Read a. | 200 |
| PUT | `/api/v1/a` | Write a. | 202 |
| POST | `/api/v1/b` | Do b. | 204 |
EOF
        cat >"${dir}/settings.md" <<'EOF'
# The settings tree

## `hostname`

| Key | Type | Default |
|---|---|---|
| `hostname` | string | `mica` |

## `time`

| Key | Type | Default |
|---|---|---|
| `ntpServers` | list | `[]` |
| `timezone` | IANA zone name | `UTC` |
EOF
        cat >"${dir}/cli.md" <<'EOF'
# The `mica` command

From release r1.

## 3. Conventions

| Code | Meaning |
|---|---|
| 0 | done |
| 1 | refused |
| 2 | misused |
| 3 | not reached: `NoReply` |
| 4 | a credential: `login_throttled` |

## 4. Verb list

| Verb | Does |
|---|---|
| [`status`](#status) | at a glance |
| [`set`](#set) | write one |
| `help` | the list |

## 5. The verbs

### status

Reads.

### set

| Setting | Type |
|---|---|
| `hostname`, `time.timezone` | string |

The generic `PUT` takes the 2 paths above.

### end
EOF
    done
}

pass=0
fail=0
# <name> <expected exit> <expected message> <edit command run in the docs root>
check() {
    local docs="${WORK}/docs-$((pass + fail))"
    rm -rf "$docs"
    write_pages "$docs"
    (cd "$docs" && eval "$4")
    set +e
    MICA_REFERENCE_DOCS="$docs" bash "$VERIFIER" >"${WORK}/out" 2>&1
    local got=$?
    set -e
    if [ "$got" -eq "$2" ] && grep -qF -- "$3" "${WORK}/out"; then
        pass=$((pass + 1))
    else
        fail=$((fail + 1))
        echo "FAIL ${1}: exit ${got}, expected ${2} with: ${3}"
        sed 's/^/    /' "${WORK}/out"
    fi
}

ns='sed -i'
check "agreeing pages pass" 0 ": PASS" ":"
check "a route missing from the page" 1 "en/http-api.md lacks POST /api/v1/b" \
    "$ns '/api\/v1\/b/d' reference/http-api.md"
check "a route the schema does not have" 1 "zh/http-api.md lists DELETE /api/v1/a" \
    "printf '| DELETE | \`/api/v1/a\` | x | 204 |\n' >>zh/reference/http-api.md"
check "a wrong operation count" 1 "header does not state 3" \
    "$ns 's/3 operations/4 operations/' reference/http-api.md"
check "a page not naming the release" 1 "http-api.md does not name release r1" \
    "$ns 's/release r1/release r0/' zh/reference/http-api.md"
check "a key the model does not have" 1 "\`zone\` under \`time\` is not a field of the model" \
    "$ns 's/| \`timezone\` |/| \`zone\` |/' reference/settings.md"
check "a model field left undocumented" 1 "zh/settings.md does not document \`time.ntpServers\`" \
    "$ns '/ntpServers/d' zh/reference/settings.md"
check "a subtree the model does not have" 1 "documents \`clock\`, which is not a subtree" \
    "$ns 's/## \`time\`/## \`clock\`/' reference/settings.md"
check "a verb missing from the table" 1 "en/cli.md verb table ['status'] differs from VERBS" \
    "$ns '/\[\`status\`\]/d' reference/cli.md"
check "a verb without a section" 1 "zh/cli.md has no section for \`status\`" \
    "$ns 's/^### status/### state/' zh/reference/cli.md"
check "a credential code missing from exit 4" 1 "exit 4 row lacks \`login_throttled\`" \
    "$ns 's/: \`login_throttled\`//' reference/cli.md"
check "an unreachable error missing from exit 3" 1 "exit 3 row lacks \`NoReply\`" \
    "$ns 's/: \`NoReply\`//' zh/reference/cli.md"
check "a mica set path missing" 1 "\`mica set\` table ['time.timezone'] differs from KNOWN" \
    "$ns 's/, \`time.timezone\`//' reference/cli.md"
check "a wrong mica set path count" 1 "does not state the 2 paths of KNOWN" \
    "$ns 's/the 2 paths/the 3 paths/' reference/cli.md"

# A reader that cannot reach the release is exit 2, not a pass.
cat >"${WORK}/broken" <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
chmod +x "${WORK}/broken"
docs="${WORK}/docs-broken"
write_pages "$docs"
set +e
MICA_REFERENCE_READER="${WORK}/broken" MICA_REFERENCE_DOCS="$docs" bash "$VERIFIER" >"${WORK}/out" 2>&1
got=$?
set -e
if [ "$got" -eq 2 ] && grep -qF "cannot read micaoss/mica-core" "${WORK}/out"; then
    pass=$((pass + 1))
else
    fail=$((fail + 1))
    echo "FAIL an unreachable release: exit ${got}, expected 2"
    sed 's/^/    /' "${WORK}/out"
fi

echo "tools/docs/verify-reference-test.sh: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
