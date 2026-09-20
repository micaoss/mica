#!/usr/bin/env python3
"""Reference checker for docs/design/release-lock.md.

It checks the file rules of `mica-lock v1`, `mica-pin v1` and the offline
side of the `repos/` cache, and prints `valid` or `refused <rule>`. It exists
to prove the test vectors under docs/design/release-lock/vectors/ against
their expected results; each repository implements the same rules in its own
tools. Registry checks (digests read back, package sha256 = pool layer) are
out of its scope.

    release-lock-check.py lock <file>
    release-lock-check.py upstream <file>              (locks/upstream.lock)
    release-lock-check.py vectors-pin <file>            (a repository's vectors.pin)
    release-lock-check.py pins <locks-dir> ci|local    (<locks-dir> holds <repository>[.<scope>].lock and pins/<repository>[.<scope>].pin)
    release-lock-check.py repos <dir> offline
"""
import hashlib
import os
import re
import sys


class Refused(Exception):
    pass


KIND_COLUMNS = {"release": 4, "image": 5, "pool": 3, "package": 5, "board": 5, "upstream": 7, "apt": 5,
                "input": 4, "origin": 3, "built": 5, "index": 3, "product": 8, "bundle": 4, "asset": 6,
                "data": 4}
KIND_ORDER = list(KIND_COLUMNS)
BASE_ONLY = {"upstream", "apt"}
BUILD_ONLY = {"input", "origin", "built", "index", "product", "bundle", "asset"}
INDEX_KINDS = {"origin", "built", "index"}
INDEX_SCOPE = "mica"
PROFILE = {"dev", "prod"}
GENERATION = re.compile(r"^[1-9][0-9]*$")
BUNDLE = {"image", "update"}
UPDATE_SUFFIX = {"full": "micaupd", "root": "root.micaupd", "kernel": "kernel.micaupd"}
REPOSITORY = re.compile(r"^[a-z0-9][a-z0-9-]*$")
RELEASE = re.compile(r"^[0-9]{8}-[0-9]{4}$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
SCOPED = {"mica-boards", "mica-build"}
COMPONENT = {"board", "kernel", "uboot", "firmware", "packer"}
SCOPE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
ARCH = {"amd64", "arm64"}
PLATFORM = {"index", "amd64", "arm64", "386"}
NAME = re.compile(r"^[a-z0-9][a-z0-9.+-]*$")
UPSTREAM_NAME = re.compile(r"^[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+)?$")
UPSTREAM_REFERENCE = re.compile(r"^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::[0-9]+)?/[a-z0-9._/-]+(?::[A-Za-z0-9._-]+)?@sha256:[0-9a-f]{64}$")
VERSION = re.compile(r"^[A-Za-z0-9.+~:-]+$")
REFERENCE = re.compile(r"^(?P<registry>ghcr\.io/micaoss|local)/(?P<repository>[a-z0-9][a-z0-9-]*)(?::(?P<tag>[A-Za-z0-9._-]+))?@sha256:(?P<digest>[0-9a-f]{64})$")


def lines_of(path, header):
    data = open(path, "rb").read()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise Refused("encoding")
    if not text.endswith("\n") or "\r" in text:
        raise Refused("encoding")
    lines = text[:-1].split("\n")
    if lines[0] != header:
        raise Refused("header")
    rows = []
    for line in lines[1:]:
        if line == "" or line.endswith("\t") or line.startswith(" "):
            raise Refused("encoding")
        if line.startswith("#"):
            continue
        rows.append(line.split("\t"))
    return rows


def field(ok):
    if not ok:
        raise Refused("field-value")


def check_upstream_image(row):
    field(UPSTREAM_NAME.match(row[2]) and row[3] in PLATFORM)
    if "@sha256:" not in row[4]:
        raise Refused("reference-digest")
    if row[4].startswith(("ghcr.io/micaoss/", "local/")):
        raise Refused("reference-upstream")
    field(UPSTREAM_REFERENCE.match(row[4]))


def check_lock(path):
    rows = lines_of(path, "# mica-lock v1")
    for row in rows:
        if row[0] not in KIND_COLUMNS:
            raise Refused("kind-unknown")
        if len(row) != KIND_COLUMNS[row[0]]:
            raise Refused("column-count")
    if not rows or rows[0][0] != "release" or sum(r[0] == "release" for r in rows) != 1:
        raise Refused("release-row")
    _, repository, release, commit = rows[0]
    scope, _, release = release.rpartition(".")
    field(REPOSITORY.match(repository) and (RELEASE.match(release) or release == "offline") and COMMIT.match(commit)
          and (scope == "" or SCOPE.match(scope)))
    if (scope != "") != (repository in SCOPED):
        raise Refused("release-scope")
    if scope == INDEX_SCOPE and repository != "mica-build":
        raise Refused("index-scope")
    index_lock = repository == "mica-build" and scope == INDEX_SCOPE
    registry = "local" if release == "offline" else "ghcr.io/micaoss"

    def reference(value, expected=repository):
        if "@sha256:" not in value:
            raise Refused("reference-digest")
        m = REFERENCE.match(value)
        if not m:
            raise Refused("field-value" if value.startswith(("ghcr.io/micaoss/", "local/")) else "reference-registry")
        if m.group("registry") != registry:
            raise Refused("reference-registry")
        if m.group("repository") != expected:
            raise Refused("reference-repository")
        return m.group("tag") or ""

    board_scope = scope if repository == "mica-boards" else ""

    def index_input(name):
        input_repository, _, input_scope = name.partition(".")
        field(input_repository == "mica-build" and SCOPE.match(input_scope))
        if input_scope == INDEX_SCOPE:
            raise Refused("index-scope")

    def asset_file(row, asset_release):
        prefix = "mica-" + row[1] + "-" + asset_release + "."
        if row[2] == "image":
            return row[4].startswith(prefix)
        return row[4] == prefix + UPDATE_SUFFIX[row[3]]

    keys, pools, sort_keys = set(), set(), []
    for row in rows[1:]:
        kind = row[0]
        if kind == "image":
            if row[1] == "upstream":
                check_upstream_image(row)
            elif REPOSITORY.match(row[1]):
                field(NAME.match(row[2]) and row[3] in PLATFORM)
                reference(row[4], row[1])
                if row[1] != repository:
                    raise Refused("image-source")
            else:
                raise Refused("image-source")
            key = (row[1], row[2], row[3])
        elif kind == "pool":
            field(row[1] in ARCH)
            tag = reference(row[2])
            if board_scope and not tag.startswith("pool." + board_scope + "." + row[1] + "."):
                raise Refused("scope-content")
            key = (row[1],)
            pools.add(row[1])
        elif kind == "package":
            field(NAME.match(row[1]) and row[2] in ARCH and VERSION.match(row[3]) and SHA256.match(row[4]))
            key = (row[1], row[2])
        elif kind == "board":
            field(NAME.match(row[1]) and row[2] in COMPONENT and row[3] in ARCH)
            tag = reference(row[4])
            if board_scope and (row[1] != board_scope or not tag.startswith(row[2] + "." + row[1] + ".")):
                raise Refused("scope-content")
            key = (row[1], row[2])
        elif kind == "upstream":
            roots = row[6].split(",")
            field(NAME.match(row[1]) and row[2] in ARCH and VERSION.match(row[3]) and SHA256.match(row[4])
                  and row[5].startswith("https://") and all(NAME.match(r) for r in roots) and roots == sorted(set(roots)))
            key = (row[1], row[2])
        elif kind == "apt":
            field(row[1].startswith("https://") and row[2] and row[3] and row[4].startswith("/"))
            key = ()
        elif kind == "input":
            name, _, input_scope = row[1].partition(".")
            field(REPOSITORY.match(name) and (input_scope == "" or SCOPE.match(input_scope))
                  and (RELEASE.match(row[2]) or row[2] == "offline") and SHA256.match(row[3]))
            if (input_scope != "") != (name in SCOPED):
                raise Refused("release-scope")
            if input_scope == INDEX_SCOPE:
                raise Refused("index-scope")
            key = (row[1],)
        elif kind == "origin":
            index_input(row[1])
            field(COMMIT.match(row[2]))
            key = (row[1],)
        elif kind == "built":
            index_input(row[1])
            name, _, built_scope = row[2].partition(".")
            if not (REPOSITORY.match(name) and (built_scope == "" or SCOPE.match(built_scope))
                    and (built_scope != "") == (name in SCOPED)
                    and (RELEASE.match(row[3]) or row[3] == "offline") and SHA256.match(row[4])):
                raise Refused("index-built-form")
            key = (row[1], row[2])
        elif kind == "index":
            field(SCOPE.match(row[1]))
            if row[1] == INDEX_SCOPE:
                raise Refused("index-scope")
            index_input(row[2])
            key = (row[1],)
        elif kind == "product":
            field(SCOPE.match(row[1]) and SCOPE.match(row[2]) and row[3] in PROFILE and GENERATION.match(row[4])
                  and all(SHA256.match(v) for v in row[5:8]))
            if INDEX_SCOPE in (row[1], row[2]):
                raise Refused("index-scope")
            key = (row[1],)
        elif kind == "bundle":
            field(SCOPE.match(row[1]) and row[2] in BUNDLE)
            reference(row[3])
            key = (row[1], row[2])
        elif kind == "asset":
            field(SCOPE.match(row[1]) and row[2] in BUNDLE and SHA256.match(row[5])
                  and (NAME.match(row[3]) if row[2] == "image" else row[3] in UPDATE_SUFFIX))
            if not index_lock:
                field(asset_file(row, release))
            key = (row[1], row[2], row[3])
        elif kind == "data":
            # 1.2.4: any repository may name producer-data assets. The file is
            # the second key: two names for one file would make the asset's
            # meaning depend on which row a reader happened to take.
            field(NAME.match(row[1]) and NAME.match(row[2]) and SHA256.match(row[3]))
            if any(r[0] == "data" and r[2] == row[2] and r is not row for r in rows):
                raise Refused("data-file")
            key = (row[1],)
        else:
            raise Refused("release-row")
        if (kind,) + key in keys:
            raise Refused("duplicate-key")
        keys.add((kind,) + key)
        sort_keys.append((KIND_ORDER.index(kind),) + tuple(k.encode() for k in key))
    if repository != "mica-system-base" and any(r[0] in BASE_ONLY for r in rows):
        raise Refused("base-only-kind")
    if repository != "mica-build" and any(r[0] in BUILD_ONLY for r in rows):
        raise Refused("build-only-kind")
    if not index_lock and any(r[0] in INDEX_KINDS for r in rows):
        raise Refused("index-scope")
    if index_lock:
        if not any(r[0] == "index" for r in rows):
            raise Refused("index-scope")
        if any(r[0] in ("image", "pool", "package", "board", "upstream", "apt") for r in rows) \
                or any(r[0] == "input" and r[1].partition(".")[0] != "mica-build" for r in rows):
            raise Refused("index-only-inputs")
        inputs = {r[1]: r[2] for r in rows if r[0] == "input"}
        if any(r[0] in ("origin", "built") and r[1] not in inputs for r in rows) \
                or any(r[0] == "index" and r[2] not in inputs for r in rows) \
                or any(sum(r[0] == "origin" and r[1] == name for r in rows) != 1
                       or not any(r[0] == "built" and r[1] == name for r in rows) for name in inputs):
            raise Refused("index-input")
        indexed = {r[1]: inputs[r[2]] for r in rows if r[0] == "index"}
        if {r[1] for r in rows if r[0] == "product"} != set(indexed) \
                or any(r[0] in ("bundle", "asset") and r[1] not in indexed for r in rows):
            raise Refused("index-product-source")
        for r in rows:
            if r[0] == "bundle" and REFERENCE.match(r[3]).group("tag") != r[2] + "." + r[1] + "." + indexed[r[1]]:
                raise Refused("index-product-source")
            if r[0] == "asset" and not asset_file(r, indexed[r[1]]):
                raise Refused("index-product-source")
    products = {r[1] for r in rows if r[0] == "product"}
    bundles = {(r[1], r[2]) for r in rows if r[0] == "bundle"}
    if any(r[0] in ("bundle", "asset") and r[1] not in products for r in rows):
        raise Refused("bundle-without-product")
    if any(r[0] == "asset" and (r[1], r[2]) not in bundles for r in rows):
        raise Refused("asset-without-bundle")
    if any(r[0] == "bundle" and r[2] == "update" and not any(a[0] == "asset" and a[1:4] == [r[1], "update", "full"] for a in rows)
           for r in rows):
        raise Refused("update-full")
    if any(r[0] == "package" and r[2] not in pools for r in rows):
        raise Refused("package-without-pool")
    if repository == "mica-boards" and not {"board", "kernel"} <= {r[2] for r in rows if r[0] == "board"}:
        raise Refused("board-components")
    if sort_keys != sorted(sort_keys):
        raise Refused("sort-order")
    return repository, scope, release


UPSTREAM_COLUMNS = {"image": 5, "source": 6, "git": 5}


def check_upstream(path):
    rows = lines_of(path, "# mica-lock v1")
    for row in rows:
        if row[0] == "release":
            raise Refused("upstream-release-row")
        if row[0] not in UPSTREAM_COLUMNS:
            raise Refused("kind-unknown")
        if len(row) != UPSTREAM_COLUMNS[row[0]]:
            raise Refused("column-count")
    keys, sort_keys = set(), []
    order = list(UPSTREAM_COLUMNS)
    for row in rows:
        kind = row[0]
        if kind == "image":
            if row[1] != "upstream":
                raise Refused("image-source")
            check_upstream_image(row)
            key = (row[1], row[2], row[3])
        elif kind == "source":
            field(NAME.match(row[1]) and row[2] in ARCH | {"all"} and VERSION.match(row[3])
                  and SHA256.match(row[4]) and row[5].startswith("https://"))
            key = (row[1], row[2])
        else:
            field(NAME.match(row[1]) and row[2].startswith("https://") and row[3] and COMMIT.match(row[4]))
            key = (row[1],)
        if (kind,) + key in keys:
            raise Refused("duplicate-key")
        keys.add((kind,) + key)
        sort_keys.append((order.index(kind),) + tuple(k.encode() for k in key))
    if sort_keys != sorted(sort_keys):
        raise Refused("sort-order")


def read_pin(path):
    data = open(path, "rb").read()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise Refused("encoding")
    if not text.endswith("\n") or "\r" in text:
        raise Refused("encoding")
    lines = text[:-1].split("\n")
    if lines[0] != "# mica-pin v1":
        raise Refused("header")
    pairs = [line.split("=", 1) if "=" in line else [line, None] for line in lines[1:]]
    keys = [k for k, _ in pairs]
    values = dict(pairs)
    offline = values.get("RELEASE") == "offline"
    scoped = "SCOPE" in values
    if keys != (["REPOSITORY"] + (["SCOPE"] if scoped else []) + ["RELEASE", "SHA256SUMS"]
                + (["CHECKOUT"] if offline else [])):
        raise Refused("pin-format")
    field(REPOSITORY.match(values["REPOSITORY"]) and SHA256.match(values["SHA256SUMS"])
          and (offline or RELEASE.match(values["RELEASE"])) and (not scoped or SCOPE.match(values["SCOPE"])))
    if offline:
        field(os.path.isabs(values["CHECKOUT"]))
    return values


def check_vectors_pin(path):
    # 9.2: the two-key pin that names the vectors a reader conforms to. It is
    # read by a gate, not by a person, which is why the commit is the full 40
    # hex and why nothing else is allowed in the file: a second key would be a
    # second source of truth beside the one the gate acts on.
    data = open(path, "rb").read()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise Refused("encoding")
    if not text.endswith("\n") or "\r" in text:
        raise Refused("encoding")
    lines = text[:-1].split("\n")
    if lines[0] != "# mica-vectors-pin v1":
        raise Refused("header")
    # Comment lines are allowed after the header and carry no claim the gate
    # acts on: the first real pin used one to record that its commit carries a
    # known inert defect, and forbidding it would have pushed that into nowhere.
    body = [line for line in lines[1:] if not line.startswith("#")]
    pairs = [line.split("=", 1) if "=" in line else [line, None] for line in body]
    if [k for k, _ in pairs] != ["REPOSITORY", "COMMIT"]:
        raise Refused("pin-format")
    values = dict(pairs)
    field(REPOSITORY.match(values["REPOSITORY"]) and COMMIT.match(values["COMMIT"]))


def check_pins(directory, mode):
    pins_dir = os.path.join(directory, "pins")
    pins = sorted(f[:-4] for f in os.listdir(pins_dir) if f.endswith(".pin"))
    locks = sorted(f[:-5] for f in os.listdir(directory) if f.endswith(".lock") and f != "upstream.lock")
    records = {}
    for name in pins:
        values = read_pin(os.path.join(pins_dir, name + ".pin"))
        repository, _, scope = name.partition(".")
        if values["REPOSITORY"] != repository:
            raise Refused("name-mismatch")
        if values.get("SCOPE", "") != scope:
            raise Refused("scope-mismatch")
        if ("SCOPE" in values) != (repository in SCOPED):
            raise Refused("release-scope")
        records[name] = values
    for name in pins:
        if name not in locks:
            raise Refused("pin-without-lock")
    for name in locks:
        if name not in pins:
            raise Refused("lock-without-pin")
    for name, values in records.items():
        try:
            lock_repository, lock_scope, lock_release = check_lock(os.path.join(directory, name + ".lock"))
        except Refused:
            raise Refused("lock-invalid")
        if lock_repository != values["REPOSITORY"]:
            raise Refused("lock-invalid")
        if lock_scope != values.get("SCOPE", ""):
            raise Refused("scope-mismatch")
        if lock_release != values["RELEASE"]:
            raise Refused("release-mismatch")
        if "CHECKOUT" in values and mode == "ci":
            raise Refused("checkout-in-ci")


def check_repos(directory, mode):
    (digest, _url), = [line.split("\t") for line in open(os.path.join(directory, "request")).read().splitlines()]
    path = os.path.join(directory, "repos", "sha256", digest)
    if not os.path.exists(path):
        if mode == "offline":
            raise Refused("offline-miss")
        raise Refused("fetch-required")
    if hashlib.sha256(open(path, "rb").read()).hexdigest() != digest:
        raise Refused("cache-corrupt")


def main(argv):
    try:
        if argv[1] == "lock":
            check_lock(argv[2])
        elif argv[1] == "upstream":
            check_upstream(argv[2])
        elif argv[1] == "vectors-pin":
            check_vectors_pin(argv[2])
        elif argv[1] == "pins":
            check_pins(argv[2], argv[3])
        elif argv[1] == "repos":
            check_repos(argv[2], argv[3])
        else:
            raise SystemExit(__doc__)
    except Refused as refusal:
        print("refused", refusal)
        return
    print("valid")


if __name__ == "__main__":
    main(sys.argv)
