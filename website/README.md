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
published**. `../docs` also carries proposed work, reference contracts and website briefs
that would mislead a visitor.

- The allowlist is [`published-docs.json`](published-docs.json), read through
  `src/shared/docs/published.ts`. Adding a file to `../docs` publishes nothing; adding
  an entry there does.
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

### Where it all comes from

```
mica-build ──posts each release──> the resource service (res.micaos.dev)
    <root>products/v1.json            the index: every listed board and product, its words
                                      and its newest release's identity; no files
        ──(the Worker, on request; cached ten minutes)──> GET /api/catalog
    <root>products/v1/<board>.json    one board: its guides, its products with the files of
                                      their newest release, and the words those files use
        ──(the Worker, on request; cached ten minutes)──> GET /api/catalog/<board>
    <root>v1/<product>/releases.json  that product's releases, newest first
    <release directory>/index.json    one release: its files, sizes and hashes
        ──(the browser, when a visitor opens the history)
```

Every release is posted to the resource service as it is published (`mica-build:README.md`).
The root is `https://res.micaos.dev/update/`, the one a device is configured with. Nothing is
read from GitHub and nothing is inferred from a file name.

**The resource service is the only source of product data**
(`mica-res:docs/spec/product-catalogue.md`). Its product catalogue says which boards and
products there are, in what order, what a board, a product and a file type are called in
both languages, and which documents a board's page links to. An admin edits all of it in the
resource service's console, and this site keeps no copy
(`src/features/download/products-catalog.ts`). What stays here is the page copy and the
page templates.

**A page loads what it shows.** `/download/` reads the index; a board's page reads that
board's document. The Worker answers each from the resource service (`worker/index.ts`) and
holds each answer in the edge cache for ten minutes, so a release, a board or a word an
admin changed shows on the site within that window and nothing has to run for it.

**Nobody waits for the resource service.** The Worker keeps the last answer that parsed for
a week. Once the ten minutes are over it answers that copy at once, marked `refreshing`, and
reads the document again behind the response. The page does the same on its side
(`src/features/download/use-catalogue.ts`): it shows the copy this browser kept from its last
visit, then the endpoint's answer, and asks once more a few seconds after a `refreshing`
answer. Only a first visit to a Worker that has never read the document waits, and says it
is reading rather than that nothing is published.

**A board page opens on each product's newest release**, in the catalogue's order. A
product's earlier releases are in neither document: they are read by the browser, from the
history the product names, when a visitor asks for them.

A board with no product is an **empty** catalogue: its page says nothing is published yet.
A document that does not answer is a failure, never "nothing published": the Worker goes on
answering the last copy that parsed and asks again a minute later. Files that exist and
parse to nothing are a failure too.

### What things are called

`src/features/download/download-map.ts` reads the catalogue's words with the fallbacks its
contract states: a file's category and form from `categories` and `fileTypes`, a product from
`products`. An unfilled language falls back to the other; a kind, form or product the
catalogue has no words for is shown under its own name, so a board's new image kind or
product appears on the site before an admin words it.

### Boards, their pages and their guides

**Which boards there are is the catalogue's.** No page is built per board. The build makes
one template, `/download/board-page/`, and the Worker serves it as `/download/<board>/` for
any board the index lists, with the board's name in place of the template's placeholder, and
answers 404 for a board it does not list (`worker/index.ts`). A board an admin adds or hides
in the resource service appears or disappears on the site with no deploy. When the index
cannot be read at all, a board's page is still served, and fills itself in the browser.

**Board wording is in the pages' HTML.** The landing page's board table and a board page's
hardware and status line are read by a visitor and a crawler before any script runs, so the
built pages carry fill points and the Worker fills them from the index when a page is
requested (`worker/pages.ts`; `run_worker_first` in `wrangler.jsonc` names the routes). The
table's rows are the catalogue's boards, in its order. Whatever fails on that path, the page
is served as built. The board cards of `/download/` are drawn in the browser, from the index.

**A board's guides are the catalogue's too**
(`src/features/download/components/board-guides.tsx`). A guide carries its title and body in
both languages and one target: `doc`, a slug of this site's documentation, linked in the
page's language, or `url`, an outside address. The resource service cannot know which slugs
this site publishes, so the Worker checks them against `published-docs.json`: a guide to a
document that is not published is left out, and named in the `status` of
`/api/catalog/<board>` so an admin can find a stale slug.

### When the catalogue goes stale

Each answer of `/api/catalog` and `/api/catalog/<board>` carries a `status` beside its
content — when the document was last read, when a read last succeeded, and the error of the
last one that failed or the stale guide slugs it found — so a stale answer says so rather
than looking current.

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

Nothing in this repository. An admin lists the board in the resource service's console
(Resources -> Products), with its hardware, status and guides; the board then has a row in
the landing page's table, a card on `/download/` and a page at `/download/<board>/` in both
languages, within the Worker's ten-minute cache. A board is also listed by its first release.

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
scripts/            docs prepare, dev server
```

## Stack

Astro 7, Starlight, React 19 (islands only), TypeScript, Tailwind CSS v4, shadcn/ui
(base-nova) on `@base-ui/react`, Vitest.

## License

[Apache-2.0](../LICENSE).
