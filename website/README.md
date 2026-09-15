# Mica OS website

The public site for Mica OS — a minimal Linux for embedded and industrial devices. It
lives in this repository, beside the documentation it publishes. An Astro site: a hand-built landing page and
documentation portal, with the documentation itself rendered through Starlight. Bilingual
(Chinese at the root, English under `/en/`) with a three-mode theme.

## Quick start

```bash
bun install
bun run dev          # serves mica.localhost through nsl
```

`astro dev` daemonises itself, so the dev server keeps running after the command returns:

```bash
bun run dev:logs     # follow it
bun run dev:stop     # shut it down
```

## Quality gates

```bash
bun run lint && bun run typecheck && bun run test && bun run build
```

`bun run test:coverage` adds the coverage report.

## Where the documentation comes from

Documentation bodies live in `../docs`, and **only what is explicitly allowlisted is
published**. That repository is an engineering record: it carries proposed
work, internal decisions and board dossiers that would mislead a visitor.

- The allowlist is [`src/shared/docs/published.ts`](src/shared/docs/published.ts). Adding a
  file to `../docs` publishes nothing; adding a line here does.
- `bun run docs:prepare` copies the allowlisted files into `src/content/docs/`, lifting
  each `# H1` into the frontmatter title Starlight needs and retargeting every relative
  link — to a site URL when the target is published, to a GitHub URL when it is not. A
  link that resolves to neither fails the build.
- The documentation is never modified. `src/content/docs/` is generated and git-ignored.

`MICA_DOCS_ROOT` overrides the documentation root; it defaults to `../docs`.

## The download catalogue

`/download/` lists the boards; each board's page (`/download/<board>/`) carries what can be
obtained for it, in three forms: **system image**, **update package**, **firmware package**.
The components inside a deployment — kernel, root, support — are not downloads; they arrive
through an update. A board page opens on the newest version of each form and profile, and a
control loads the earlier ones.

The board pages read `/api/catalog` at runtime and keep the rows whose `board` is theirs.
`website/worker/index.ts` answers it: with `CATALOG_SOURCE` set — a URL serving the same
JSON — it passes that through; with nothing configured it answers an empty catalogue, which
is the current state, because no repository publishes a product image yet.

Every entry is validated in the page (`src/features/download/catalog-schema.ts`) and dropped
whole if a field is missing, so a malformed upstream degrades to the empty state rather than
to invented rows. Set the source with `wrangler secret put CATALOG_SOURCE`, or as a plain
var in `wrangler.jsonc` if it is not a secret.

```json
{
  "downloads": [
    {
      "board": "x64",
      "profile": "dev",
      "kind": "image",
      "version": "2026.09-2",
      "deploymentId": "dep-aa11",
      "releasedAt": "2026-09-12",
      "bytes": 1073741824,
      "digest": "sha256:…",
      "href": "https://…/disk.img",
      "filename": "disk.img"
    }
  ]
}
```

`kind` is `image`, `update` or `firmware`; `profile` is `dev` or `prod`; `releasedAt` orders
the versions, so an entry without it is dropped. A bare array is accepted too.

Setting `CATALOG_DEMO=1` (and no source) serves a sample catalogue that answers
`"sample": true`, which the page renders behind a banner saying so. It exists to exercise
the filters and the history control; it is not a release and must not be presented as one.

## Adding a board

A board is two lines of copy and a deploy:

1. Add a row to `boards.rows` in `src/shared/i18n/zh.ts` — `board`, `hw`, `status`.
2. Add the same `board` to `src/shared/i18n/en.ts`, with the English `hw` and `status`.
3. Deploy.

That row is the whole source: the landing page's board table, the card on `/download/`, and
the `/download/<board>/` pages of both locales, which `getStaticPaths()` generates from it.
Nothing else needs changing — whether a board has anything to download comes from
`/api/catalog` at runtime, and a board with nothing published says so.

The `board` identifier has to match between the locales, because each generates its own
routes; `src/shared/i18n/boards.test.ts` fails the build when they drift.

## Layout

```text
astro.config.ts     integrations, Starlight config, sidebar
src/
  pages/            /, /en/, /docs/, /en/docs/
  content/docs/     generated — the prepared documentation
  components/       layout shell, site header, docs portal, Starlight overrides
  features/landing/ the landing page sections
  shared/
    components/     Blueprint frame, brand marks, shadcn/ui primitives
    docs/           the allowlist and the link-rewriting rules
    hooks/          the three-mode theme
    i18n/           the zh and en dictionaries
  styles/global.css palette, Tailwind theme tokens, Starlight token mapping
scripts/            docs sync, docs prepare, dev server
```

## Stack

Astro 7, Starlight, React 19 (islands only), TypeScript, Tailwind CSS v4, shadcn/ui
(base-nova) on `@base-ui/react`, Vitest.

## License

[Apache-2.0](LICENSE).
