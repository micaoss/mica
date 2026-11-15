#!/usr/bin/env python3
"""Hold three reference pages to the core release they are written from.

    python3 tools/docs/verify-reference.py <core dir> <docs dir> <release>

<core dir> holds the files tools/docs/verify-reference.sh fetched from
mica-core at <release>, under their repository paths. <docs dir> is the
documentation root. Every page is checked in English and in Chinese.

  http-api   every (method, path) of crates/mica-apid/openapi.json is a row
             of reference/http-api.md, no row names anything else, and the
             header states the path and operation counts and the release.
  settings   every key reference/settings.md documents resolves to a field
             of the micad-settings model (crates/micad-settings/src/model*),
             and every field of a documented subtree is documented or listed
             in UNDOCUMENTED below with its reason.
  cli        reference/cli.md lists exactly the verbs of `VERBS` in
             crates/micad/src/cli.rs, gives each a section, states exit
             codes 0 to 4 with every credential and unreachable code the
             source maps, and its `mica set` table names exactly the paths of
             `KNOWN` in crates/micad/src/cli/settings.rs.

What it does not check: default values, types and limits in the settings
tables, the prose of any page, and output formats. Those stay review's.
"""
import json
import re
import sys
from pathlib import Path

CORE, DOCS, RELEASE = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
LOCALES = {"en": DOCS / "reference", "zh": DOCS / "zh" / "reference"}
METHODS = ("get", "post", "put", "patch", "delete")

# Model fields under a documented subtree that the settings page leaves out
# on purpose, each with the reason. A field missing from the page and from
# this list is drift.
UNDOCUMENTED = {
    "access.webAdmin": "the administrator credential: written by setup, never by an operator",
    "access.claim": "how the device was claimed: written by the claim, read through GET /api/v1/claim",
    "access.device": "the device credential record: written by provisioning",
    "access.apiTokens": "token digests: managed through /api/v1/tokens",
    "container.projectDirs": "documented as the project directory row",
}

fails = []


def fail(check, message):
    fails.append(f"{check}: {message}")


def page(locale, name):
    path = LOCALES[locale] / name
    if not path.is_file():
        fail(name, f"{path} is missing")
        return ""
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------- http-api
def check_http_api():
    spec = json.loads((CORE / "crates/mica-apid/openapi.json").read_text())
    want = {
        (method.upper(), path)
        for path, item in spec["paths"].items()
        for method in item
        if method in METHODS
    }
    paths = len(spec["paths"])
    for locale in LOCALES:
        text = page(locale, "http-api.md")
        rows = re.findall(r"^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)` \|", text, re.M)
        got = set(rows)
        where = f"{locale}/http-api.md"
        if len(rows) != len(got):
            fail("http-api", f"{where} lists a route twice")
        for method, path in sorted(want - got):
            fail("http-api", f"{where} lacks {method} {path}")
        for method, path in sorted(got - want):
            fail("http-api", f"{where} lists {method} {path}, which openapi.json does not have")
        if RELEASE not in text:
            fail("http-api", f"{where} does not name release {RELEASE}")
        for number in (paths, len(want)):
            if not re.search(rf"\b{number}\b", text.split("\n## ", 1)[0]):
                fail("http-api", f"{where} header does not state {number} (paths {paths}, operations {len(want)})")


# ---------------------------------------------------------------- settings
def camel(name):
    head, *rest = name.split("_")
    return head + "".join(part.title() for part in rest)


def kebab(name):
    return name.replace("_", "-")


def attributes(text):
    """The serde attribute texts in `text`."""
    return re.findall(r"#\[serde\(((?:[^()]|\([^()]*\))*)\)\]", text, re.S)


def structs(source):
    """{name: [(field name as serialized, type, flatten)]} for every struct."""
    found = {}
    for match in re.finditer(r"((?:#\[[^\]]*\]\s*|///[^\n]*\n\s*)*)pub struct (\w+)\s*\{", source):
        rename_all = None
        for attr in attributes(match.group(1)):
            m = re.search(r'rename_all\s*=\s*"([^"]+)"', attr)
            if m:
                rename_all = m.group(1)
        depth, i = 1, match.end()
        while depth:
            depth += {"{": 1, "}": -1}.get(source[i], 0)
            i += 1
        body = source[match.end():i - 1]
        fields = []
        for f in re.finditer(r"((?:\s*(?:#\[(?:[^\[\]]|\[[^\]]*\])*\]|///[^\n]*))*)\s*pub (\w+):\s*([^\n]+?),?\s*$", body, re.M):
            attrs = " ".join(attributes(f.group(1)))
            # Not part of the written tree: skipped, or read and never written
            # (a retired key an earlier document may still carry).
            if re.search(r"\bskip(_serializing)?\b(?!_if)", attrs):
                continue
            name = f.group(2)
            m = re.search(r'\brename\s*=\s*"([^"]+)"', attrs)
            if m:
                name = m.group(1)
            elif rename_all == "camelCase":
                name = camel(name)
            elif rename_all == "kebab-case":
                name = kebab(name)
            fields.append((name, f.group(3).strip().rstrip(","), "flatten" in attrs))
        found[match.group(2)] = fields
    return found


def model_paths():
    sources = sorted((CORE / "crates/micad-settings/src").glob("model*.rs"))
    sources += sorted((CORE / "crates/micad-settings/src/model").glob("*.rs"))
    table = {}
    for source in sources:
        table.update(structs(source.read_text(encoding="utf-8")))
    if "Settings" not in table:
        fail("settings", "no `pub struct Settings` in the model sources")
        return set()
    paths = set()

    def unwrap(kind):
        while True:
            m = re.fullmatch(r"(?:Option|Box)<(.+)>", kind)
            if not m:
                return kind
            kind = m.group(1)

    def walk(struct, prefix, seen):
        for name, kind, flatten in table.get(struct, []):
            kind = unwrap(kind)
            here = prefix if flatten else prefix + [name]
            if not flatten:
                paths.add(".".join(here))
            m = re.fullmatch(r"(?:BTreeMap|HashMap)<\s*String\s*,\s*(.+)>", kind)
            if m:
                here = here + ["<key>"]
                paths.add(".".join(here))
                kind = unwrap(m.group(1))
            m = re.fullmatch(r"Vec<(.+)>", kind)
            if m:
                here = here[:-1] + [here[-1] + "[]"]
                kind = unwrap(m.group(1))
            if kind in table and kind not in seen:
                walk(kind, here, seen | {kind})

    walk("Settings", [], {"Settings"})
    return paths


def normalize(path):
    return re.sub(r"<[^>]+>", "<key>", path)


def check_settings():
    model = model_paths()
    if not model:
        return
    roots = {path.split(".")[0] for path in model}
    for locale in LOCALES:
        text = page(locale, "settings.md")
        where = f"{locale}/settings.md"
        documented = set()
        sections = re.split(r"^## ", text, flags=re.M)
        subtrees = []
        for section in sections[1:]:
            heading, _, body = section.partition("\n")
            m = re.fullmatch(r"`([^`]+)`", heading.strip())
            if not m:
                continue
            prefix = normalize(m.group(1))
            subtrees.append(prefix)
            if prefix.split(".")[0] not in roots:
                fail("settings", f"{where} documents `{prefix}`, which is not a subtree of the model")
                continue
            for row in re.findall(r"^\| ([^|]+)\|", body, re.M):
                for key in re.findall(r"`([^`]+)`", row):
                    full = normalize(key if key == prefix else f"{prefix}.{key}")
                    if full not in model:
                        fail("settings", f"{where}: `{key}` under `{prefix}` is not a field of the model")
                    documented.add(full)
        for prefix in subtrees:
            for path in sorted(model):
                if not path.startswith(prefix + "."):
                    continue
                if path in UNDOCUMENTED or any(path.startswith(u + ".") or path.startswith(u + "[]") for u in UNDOCUMENTED):
                    continue
                parent = path.rsplit(".", 1)[0]
                if path in documented or any(d.startswith(path + ".") or d.startswith(path + "[]") for d in documented):
                    continue
                # A field below a documented list or map entry is the entry's.
                if any(parent == d or parent.startswith(d + ".") or parent.startswith(d + "[]") for d in documented if d != prefix):
                    continue
                fail("settings", f"{where} does not document `{path}` (document it or add it to UNDOCUMENTED with a reason)")
    for path in UNDOCUMENTED:
        if path.split(".")[0] in roots and path not in model:
            fail("settings", f"UNDOCUMENTED names `{path}`, which the model no longer has")


# ---------------------------------------------------------------- cli
def check_cli():
    source = (CORE / "crates/micad/src/cli.rs").read_text(encoding="utf-8")
    block = re.search(r"pub const VERBS[^=]*=\s*&\[(.*?)\n\];", source, re.S)
    verbs = re.findall(r'\(\s*"([a-z-]+)",', block.group(1)) if block else []
    if not verbs:
        fail("cli", "no VERBS in cli.rs")
    exits = dict(re.findall(r"pub const EXIT_(\w+): i32 = (\d+);", source))
    credential = re.findall(r'"([a-z_]+)"', re.search(r"CREDENTIAL_CODES[^=]*=\s*&\[(.*?)\];", source, re.S).group(1))
    unreachable = [name.rsplit(".", 1)[1] for name in re.findall(
        r'"(org\.freedesktop\.DBus\.Error\.\w+)"',
        re.search(r"UNREACHABLE_ERRORS[^=]*=\s*&\[(.*?)\];", source, re.S).group(1))]
    known_source = (CORE / "crates/micad/src/cli/settings.rs").read_text(encoding="utf-8")
    known_block = re.search(r"const KNOWN[^=]*=\s*&\[(.*?)\n\];", known_source, re.S)
    known = re.findall(r'\("([a-zA-Z.]+)", Kind::', known_block.group(1)) if known_block else []
    if not known:
        fail("cli", "no KNOWN in cli/settings.rs")
    for locale in LOCALES:
        text = page(locale, "cli.md")
        where = f"{locale}/cli.md"
        if RELEASE not in text:
            fail("cli", f"{where} does not name release {RELEASE}")
        verb_section = re.search(r"^## 4\..*?\n(.*?)^## ", text, re.M | re.S)
        listed = re.findall(r"^\| (?:\[`([a-z-]+)`\]\(#[^)]*\)|`([a-z-]+)`) \|",
                            verb_section.group(1) if verb_section else "", re.M)
        listed = [a or b for a, b in listed]
        if sorted(listed) != sorted(verbs):
            fail("cli", f"{where} verb table {sorted(set(listed) ^ set(verbs))} differs from VERBS")
        for verb in verbs:
            if verb == "help":
                continue
            if not re.search(rf"^### (?:\S+ and )?{re.escape(verb)}(?: and \S+)?$", text, re.M):
                fail("cli", f"{where} has no section for `{verb}`")
        codes = dict(re.findall(r"^\| ([0-4]) \| (.+) \|$", text, re.M))
        if sorted(codes) != sorted(exits.values()):
            fail("cli", f"{where} exit table {sorted(codes)} differs from EXIT_* {sorted(exits.values())}")
        for code in credential:
            if f"`{code}`" not in codes.get(exits.get("CREDENTIAL", "4"), ""):
                fail("cli", f"{where} exit {exits.get('CREDENTIAL')} row lacks `{code}`")
        for name in unreachable:
            if f"`{name}`" not in codes.get(exits.get("UNREACHABLE", "3"), ""):
                fail("cli", f"{where} exit {exits.get('UNREACHABLE')} row lacks `{name}`")
        section = re.search(r"^### set\n(.*?)^### ", text, re.M | re.S)
        table = section.group(1) if section else ""
        documented = set()
        for row in re.findall(r"^\| ([^|]+)\|", table, re.M):
            documented.update(k for k in re.findall(r"`([a-zA-Z.]+)`", row) if "." in k or k == "hostname")
        if documented != set(known):
            fail("cli", f"{where} `mica set` table {sorted(documented ^ set(known))} differs from KNOWN")
        if not re.search(rf"\b{len(known)}\b paths|{len(known)} 个路径", table):
            fail("cli", f"{where} `mica set` does not state the {len(known)} paths of KNOWN")


check_http_api()
check_settings()
check_cli()
for line in fails:
    print(f"  DRIFT {line}", file=sys.stderr)
print(f"tools/docs/verify-reference.py: http-api, settings, cli against mica-core {RELEASE}: "
      f"{'PASS' if not fails else f'{len(fails)} DRIFT'}")
sys.exit(1 if fails else 0)
