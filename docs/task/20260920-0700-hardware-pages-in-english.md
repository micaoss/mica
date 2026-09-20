# 20260920-0700-hardware-pages-in-english Publish the hardware list: English pages and an allowlist that can name them

- **status**: completed
- **priority**: P2
- **owner**: session-hardware-en
- **createdAt**: 2026-09-20 07:00

## Description

`docs/zh/hardware/` exists but the site cannot publish it: the allowlist in
`website/published-docs.json` names a document by `name` alone and
`published.ts` hardcodes `user/<name>.md` and `zh/user/<name>.md`, so no path
outside `docs/user/` can be published, and `/docs/hardware/` is a 404.

Two halves:

1. Write the English originals under `docs/hardware/`, one page per board plus
   the list page, and bring the tree into the documentation gates — catalog
   membership, truth-status lines, and the en/zh coverage table — as every
   other published tree is.
2. Generalise the allowlist so an entry can name its directory and its slug,
   add the hardware group with its sidebar labels in both locales, and keep
   the tests that guard the engineering record out of the site.

Acceptance: `make docs-verify` and `make docs-verify-test` pass; the website's
lint, typecheck, test and build pass; `/docs/hardware/` and each board page
resolve in both locales after a deploy.

## ActiveForm

Writing the English hardware pages and widening the publishing allowlist

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Follows `20260917-1033-zh-hardware-list`, which wrote the Chinese set.
Plan: `docs/plan/20260920-0700-hardware-pages-in-english.md`.

- complete: English pages published, allowlist generalised, gates extended
