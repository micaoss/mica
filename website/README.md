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
through an update. A board page opens on the newest version of each form and product, and a
control loads the earlier ones.

### Where the rows come from

```
mica-build ──posts each release──> mica-res ──> catalog/products.json
                                             └─> catalog/products/<product>.json
        ──(CI: on push, hourly, on demand)──> KV ──> GET /api/catalog
```

Every release is posted to `mica-res` as it is published
(`mica-res:docs/spec/release-publishing.md`), and res derives two documents on its
download host, `https://dl.res.micaos.dev`: the directory of products, each with its newest
release and where its document is, and each product's document, its releases newest first
with their files, sizes and hashes. Nothing is read from GitHub and nothing is inferred from a
file name (`src/features/download/res-catalog.ts`). A row's variant (`basic`, `full`) is the
page's *Variant* column, and an update's form (`full`, `root`, `kernel`, `core`) says which
archive it is.

**The catalogue is built in CI, not in the Worker.** The website workflow's `catalog` job
reads the documents (`scripts/publish-catalog.ts`) and writes the result into KV with
`wrangler kv key put`; the Worker only reads that key.

Before the first release is posted, res answers 404 for its directory, and the catalogue is
published **empty**: every board page then says nothing is published yet, which is the truth.
A publish is refused when product documents exist and none of them parses — that means the
shape moved under the parser, not that everything was unpublished.

To refresh on demand, run the workflow: `gh workflow run website --repo micaoss/mica`.

### When the catalogue goes stale

`GET /api/catalog` answers a `status` beside the rows — when the publish ran, what triggered
it, when one last succeeded — so a stale catalogue says so rather than looking current.

### Checking the live catalogue

`bun run check:catalog` reads what res serves and fails if a published product parses to no
downloads, or if a product is published for a board the site has no page for. The `catalog`
job runs it before every publish. The logic is `src/features/download/catalog-check.ts`,
unit-tested; the script is the fetch around it.

### Setting it up

The KV namespace is bound in `wrangler.jsonc` and CI publishes into it with the
`CLOUDFLARE_API_TOKEN` the deploy already uses; that token needs **Workers KV Storage: Edit**
as well as Workers Scripts: Edit. No GitHub token is involved.

`CATALOG_BASE` selects the download host the documents are read from, defaulting to
`https://dl.res.micaos.dev`. Setting `CATALOG_DEMO=1` in `vars` puts the sample back in place of KV.

### The sample

While `CATALOG_DEMO=1` the endpoint answers a sample catalogue that declares `"sample": true`,
which the page renders behind a banner saying so. It exercises the filters and the history
control; it is not a release and must not be presented as one.

## Adding a board

1. Add a row to `boards.rows` in `src/shared/i18n/zh.ts` — `board`, `hw`, `status`.
2. Add the same `board` to `src/shared/i18n/en.ts`, with the English `hw` and `status`.
3. Add its entry to `boards.json` with the guides its page should link to.
4. Deploy.

Steps 1–2 are the whole source of the landing page's board table, the card on `/download/`,
and the `/download/<board>/` pages of both locales, which `getStaticPaths()` generates.
Whether a board has anything to download comes from `/api/catalog` at runtime; a board with
nothing published says so on its card.

The `board` identifier has to match across both dictionaries and `boards.json`, because each
locale generates its own routes; `src/shared/i18n/boards.test.ts` and
`src/features/download/boards.test.tsx` fail the build when they drift.

### Per-board guides

`boards.json` decides which documents a board's page links to, and in what order:

```json
{
  "board": "cx3576",
  "guides": [
    { "id": "install", "doc": "user/install" },
    { "id": "bench", "url": "https://github.com/micaoss/mica/blob/main/docs/boards/cx3576-bench.md" }
  ]
}
```

`doc` is a published slug under `/docs/`, resolved per locale; `url` is an external target,
for records this site does not publish — board dossiers and bench sessions live in the
repository, not here. `id` selects the wording from `download.guides` in the dictionaries
(`quickstart`, `install`, `firstRun`, `update`, `recovery`, `trouble`, `dossier`, `bench`);
an id with no wording is skipped rather than rendered blank. Adding a kind of guide means
adding its wording to both dictionaries.

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
