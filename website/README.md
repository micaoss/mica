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
through an update. A board page opens on the newest release of each product, with every file that release carries, and a
control loads the earlier ones.

### Where the rows come from

```
mica-build ──posts each release──> the resource service (res.micaos.dev)
    <root>products/v1.json            the listed boards and products, each product's newest
                                      release with its files, and what they are called
        ──(the Worker, on request; cached ten minutes)──> GET /api/catalog
    <root>v2/<product>/releases.json  that product's releases, newest first
    <release directory>/index.json    one release: its files, sizes and hashes
        ──(the browser, when a visitor opens the history)
```

Every release is posted to the resource service as it is published (`mica-build:README.md`).
The root is `https://res.micaos.dev/update/`, the one a device is configured with. Nothing is
read from GitHub and nothing is inferred from a file name.

**The resource service is the only source of product data.** The product catalogue
(`mica/products/v1`) says which boards and products are listed, in what order, and what a
board, a product and a file type are called in both languages; an admin edits it in the
resource service's console, and this site keeps no copy of any of it
(`src/features/download/products-catalog.ts`). What stays here is the page copy and
`boards.json`, the links from a board to this site's documentation.

**The Worker reads the one document on request.** `GET /api/catalog` reads it
(`worker/index.ts`), parses each product's newest release into the download rows and answers
them with the words. The answer is held in the edge cache for ten minutes, so a release, or a
word an admin changed, shows on the site within that window and nothing has to run for it.

**Nobody waits for the resource service.** The Worker keeps the last answer that parsed for
a week. Once the ten minutes are over it answers that copy at once, marked `refreshing`, and
reads the document again behind the response. The page does the same on its side
(`src/features/download/use-catalogue.ts`): it shows the catalogue this browser kept from its
last visit, then the endpoint's answer, and asks once more a few seconds after a `refreshing`
answer. Only a first visit to a Worker that has never read the document waits, and says it
is reading rather than that nothing is published.

**A board page opens on each product's newest release**, in the catalogue's order. A
product's earlier releases are not in the catalogue: they are read by the browser, from the
history the product names, when a visitor asks for them.

A catalogue that lists no product is an **empty** catalogue: every board page then says
nothing is published yet. A document that does not answer is a failure, never "nothing
published": the Worker goes on answering the last catalogue that parsed and asks again a
minute later. Files that exist and parse to nothing are a failure too.

### What things are called

`src/features/download/download-map.ts` reads the catalogue's words with the fallbacks its
contract states (`mica-res:docs/spec/product-catalogue.md`): a file's category and form from
`categories` and `fileTypes`, a product from `products`. An unfilled language falls back to
the other; a kind, form or product the catalogue has no words for is shown under its own
name, so a board's new image kind or product appears on the site before an admin words it.

### When the catalogue goes stale

`GET /api/catalog` answers a `status` beside the rows — when the documents were last read,
when a read last succeeded, and the error of the last one that failed — so a stale catalogue
says so rather than looking current. A product published for a board the site has no page
for is served, and named in that error.

### Checking the live catalogue

`bun run check:catalog` reads what res serves and fails if a published product parses to no
downloads, or if a product is listed for a board the site has no page for. It is the
same check the Worker reports in `status`, run by hand. The logic is
`src/features/download/catalog-check.ts`, unit-tested; the script is the fetch around it.

### Setting it up

Nothing beyond the deploy: the Worker needs no binding and no token. `CATALOG_ROOT` in
`vars` selects the update root the documents are read from, defaulting to
`https://res.micaos.dev/update/`. Setting `CATALOG_DEMO=1` puts the sample in place of the
live catalogue.

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
