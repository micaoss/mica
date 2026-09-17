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
mica-build's latest release ──> mica-index.json ──(parse)──> KV ──> GET /api/catalog
                                                      ▲
                                    cron every 30 min, or POST /api/catalog/refresh
```

The read path is a KV lookup and never calls GitHub, so an upstream rate limit or outage
costs a stale answer rather than a broken page.

`mica-build` publishes a version index — `mica-index.json` on the release GitHub marks
*latest*, cut automatically after a scoped release. It is the documented entry point: one
file names every current product with its board, profile, deployment identity, release, and
each image and update archive with its URL, sha256 and size
(`mica:docs/design/mica-index.md`). The Worker reads that file and nothing else; nothing is
inferred from a file name.

What the index gives that a release listing does not: the **deployment identity** behind each
row, the **uncompressed size** beside the compressed one (an image is `.img.gz`, a fraction
of what it writes), and which of the three update archives a row is — `full` always applies,
`root` only where the device already runs the kernel it names, `kernel` only where it runs
the rootfs (`mica:docs/user/update-packages.md`). Those are not interchangeable, so the table
says which.

A product absent from `products` is absent on purpose: the catalogue lists it with
`publish: false`, which is how the `-minimal` products stay off the site. An archive kind the
parser does not know is skipped rather than shown as a plain update.

### When the catalogue goes stale

`GET /api/catalog` answers a `status` beside the rows:

```json
{
  "status": {
    "lastAttemptAt": "2026-09-17T08:00:03.120Z",
    "trigger": "cron",
    "lastSuccessAt": "2026-09-16T19:30:38.632Z",
    "lastError": {
      "at": "2026-09-17T08:00:03.120Z",
      "message": "mica-index.json of mica.20260916-1709 answered 503"
    }
  }
}
```

Every refresh — the cron, `POST /api/catalog/refresh`, or the background fill of an empty
store — records when it ran, what started it, and why it failed; a success clears
`lastError` and moves `lastSuccessAt`. The status is its own KV key, so a failed attempt is
recorded without touching the rows the pages read. No GitHub API call is involved: the index
is read from `releases/latest/download/mica-index.json`, which redirects to the latest
release's asset, so the API's anonymous rate limit — which the cron's shared egress address
had exhausted — does not apply.

### Checking the live index

`bun run check:index` reads the live `mica-index.json` and fails if a published product
parses to no downloads, or if a board that is a release target upstream is missing from the
site's board list. The website workflow runs it hourly and on every push, because
`mica-build` publishes on its own schedule and nothing there triggers a build here.

It exists because both faults have happened and both passed every unit test: the fixtures
were written in the shape the parser expected, so they could not notice the release stamp
changing separator (every product dropped) or `x64` becoming `uefi-x64` (its board page went
empty). The logic is `src/features/download/index-check.ts`, unit-tested; the script is the
fetch around it.

### Setting it up

The KV namespace and the cron are configured. Nothing else is required: a request that finds
no stored catalogue fills it in the background, so the first deployment is current within a
request or two, and the cron keeps it so.

One secret is optional and worth setting:

- `REFRESH_TOKEN` — the bearer token `POST /api/catalog/refresh` requires. It is a GitHub
  secret of this repository and the deploy workflow binds it to the Worker, so rotating it
  is `gh secret set REFRESH_TOKEN` and a deploy. Without it the endpoint answers 401 to
  everyone and refreshing waits for the cron; a refresh anyone can trigger is a way to spend
  the upstream rate limit.

`CATALOG_REPO` selects the repository, defaulting to `micaoss/mica-build`. Setting
`CATALOG_DEMO=1` in `vars` puts the sample back in place of KV.

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
