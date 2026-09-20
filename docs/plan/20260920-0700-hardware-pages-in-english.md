# 20260920-0700-hardware-pages-in-english Publish the hardware list: English pages and an allowlist that can name them

- **status**: completed
- **createdAt**: 2026-09-20 07:00
- **approvedAt**: 2026-09-20 07:00
- **relatedTask**: 20260920-0700-hardware-pages-in-english

## Context

- `website/src/shared/docs/published.ts` builds every entry through
  `userDoc(name)`, which writes `user/<name>.md` and `zh/user/<name>.md`. The
  allowlist file carries `{ name, locales? }` and nothing else, so a document
  outside `docs/user/` cannot be named at all.
- `astro.config.ts` builds the Starlight sidebar from `DOC_GROUPS`, labelling
  each group from `src/shared/i18n/{en,zh}.ts` `docs.groups`. Both dictionaries
  already carry an unused `engineers` key; neither carries `hardware`.
- `published.test.ts` asserts the slug list equals `user/<name>` for every
  allowlist entry, and that no source is under the engineering trees.
- The documentation gates take explicit tree lists:
  `verify-index.sh` (one `check_readme_dir` per directory), `verify-status.sh`
  (`TREES=(docs/user docs/website docs/boards)`) and `verify-coverage.sh`
  (`TREES=(user website boards)`, rows in `docs/zh/README.md`).
- `docs/zh/hardware/` carries no `> status:` lines today, because nothing
  gated it.

## Proposal

1. `docs/hardware/{README,uefi-x64,uefi-arm64,cx3576,s905x5m}.md`: the English
   originals, same section order as the Chinese set, each carrying
   truth-status lines.
2. The Chinese pages take the same status lines in the same order, which the
   coverage gate compares.
3. Gates: one `check_readme_dir hardware` line, `docs/hardware` in
   `verify-status.sh`, `hardware` in `verify-coverage.sh`; coverage rows in
   `docs/zh/README.md`; the catalog and ownership rows in `docs/README.md`;
   `docs/user/doc-contract.md` section 5 names the tree.
4. Website: allowlist entries gain optional `dir` and `slug`; `published.ts`
   resolves `<dir>/<name>.md` and `zh/<dir>/<name>.md`; `GroupId` gains
   `hardware`; both dictionaries gain the label; `published.test.ts` asserts
   the resolution rather than the `user/` prefix.
5. Changelog, then the gated commit and a deploy.

## Risks

- A third place now states board status (English list, Chinese list, tiers
  table). Mitigation is unchanged: the pages are dated snapshots and name
  `docs/boards/support-tiers.md` as authoritative.
- Widening the allowlist widens what *can* be published; the test that keeps
  `design/`, `boards/`, `task/`, `plan/` and `research/` out of the site stays
  and is what holds the line.

## Scope

5 new English pages, 5 Chinese pages edited, 4 gate/contract files, 5 website
files.

## Alternatives

- Publish the Chinese pages alone: rejected. Repository documentation is
  English by default, and a site that carries a page in one locale only is a
  gap for every English reader.
- Point the site at `docs/boards/`: rejected. That tree is the engineering
  record — dossiers and the porting contract — and the test that keeps it off
  the site exists for that reason.

## Annotations

Approved in the session that requested it: write the English pages and change
the path allowlist.
