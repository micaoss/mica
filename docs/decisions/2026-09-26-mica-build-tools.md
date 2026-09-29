# The build and consumption rules are implemented once, in mica-build-tools

- **date**: 2026-09-26
- **kind**: engineering decision
- **owner**: the `mica-build-tools` owner (the implementation); the rules stay with `mica` and `mica-build-env`
- **review sunset**: 2027-03-26
- **status**: accepted (user, 2026-09-26: "我们是否可以把这些每个仓库都用的工具抽出来做一个mica-build-tools", "为什么我们不用ts写一份", "你创建一个仓库 写好文档 当前的不需要演进，直接切换到新版本"); designed in `mica-build-tools:docs/design.md` and implemented there, first release `20260926-2005` (`8bb0331`); switched by 2026-09-26: `mica-build-env`, `mica-core`, `mica-system-base`; in progress: `mica-podman`, `mica-build` (`docs/plan/20260926-2214-mica-build-switch-to-mica-build-tools.md`); not started: `mica-res`

## Decision

*(Amended 2026-09-29, user: "把tools和mica解耦合，后续所有的规范这边维护，mica只是让子仓库用tools即可".
The rules of the release lock no longer stay here: the specification, its vectors and the rules
of package versions are kept in `mica-build-tools` (`docs/spec/`), `docs/design/release-lock.md`
is a pointer to them, and `tools/docs/release-lock-check.py` is removed with the vectors. What
follows is the decision as taken on 2026-09-26; where it says a rule changes here first, it now
changes there.)*

`mica-build-tools` is the one implementation of the release lock
(`docs/design/release-lock.md`), the consumer's `locks/`, the source cache, and
the build rules of `mica-build-env:RULES.md`: the lock and pin checkers,
`from`, the upstream reader, `repos`, `local-lock`, the version stamp, the
inputs hash, the package-version guard, the Debian packer and pool index, the
pool publisher and release attach, and the shell lint. It is TypeScript on Bun
with no runtime dependency.

- Every repository pins it by commit in `locks/mica-build-tools.pin`
  (`docs/design/release-lock.md` 4.2; user, 2026-09-26: "放在locks里面的pin") and
  runs it through `bin/mica-tools`, a byte-identical copy of its bootstrap;
  TypeScript repositories import the same checkout.
- It is the only reader of the test vectors: it pins them in its own
  `tests/vectors.pin` and passes every family. Consumers carry no vectors and
  no `vectors.pin`. `tools/docs/release-lock-check.py` stays here as the
  independent proof of the vectors.
- The rules keep their owners. A rule changes here or in `RULES.md` first,
  then in `mica-build-tools`, then each reader moves its pin; a writer emits a
  new form only after every reader of its lock pins a commit that reads it.
- There is no transition: each repository switches in one change and deletes
  its own implementation, its vectors copy and its `vectors.pin` in it. The
  repositories' current implementations are not changed further, the reader
  step of `docs/plan/20260926-1125-apt-row-per-source.md` included.

`docs/design/release-lock.md` names it as the one implementation: section 5
(`mica-tools repos`), section 7 (`mica-tools local-lock`), and sections 9 to
9.2 (one reader of the vectors; task
`docs/task/20260926-1829-rules-name-mica-build-tools.md`).

## Rationale

Measured 2026-09-26: six lock readers in three languages
(`mica-build-env`, `mica-core` and `mica-podman` in bash, `mica-system-base`,
`mica-build` and `mica-res` in TypeScript), four pin checkers, five repositories reading the vectors each at
its own commit, four inputs hashes, three version
guards, three Debian packers, four shell lints. Section 1.2.5 needed six
changes before Base could publish one row more, and `mica-build-env`'s copy
lacked 51 of the vectors while its tests were green -- the failure section 9.1
describes, which pinning copies narrowed and one implementation removes.

Not in the `mica-build-env` images: the TypeScript repositories run bun on the
host and import in-process, and an image change is a breaking update for every
repository. Not in this repository: the publisher, registry client and packer
are build tooling, not specification.

## Removal condition

Revisited if the repositories stop sharing one lock format, or Bun leaves the
build.
