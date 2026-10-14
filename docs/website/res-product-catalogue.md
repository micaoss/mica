# The product catalogue the website reads from res

The resource service is the only source of product data for micaos.dev: which
boards and products there are, in what order, what a board, a product and a
file type are called in Chinese and English, and which documents a board's
page links to. An admin edits them in the res console (Resources -> Products),
and the website keeps no copy. This page says what the website reads and what
it does with it.

- Contract: `mica-res:docs/spec/product-catalogue.md`
- How the site is built around it: `website/README.md`, "The download catalogue"

## The documents

```
GET https://res.micaos.dev/update/products/v1.json            the index
GET https://res.micaos.dev/update/products/v1/<board>.json    one board
```

Both are built from the registry on request, CORS open. A page loads what it
shows and no more, however many products there are.

| Document | Holds |
|---|---|
| the index, `mica/products/v1` | `boards`: every listed board, with or without a release, with its `title`, `hardware` and `status`. `products`: every listed product with its words, `recommended`, the identity of its `latest` release and `releases`, the URL of its history. No files, no guides |
| a board, `mica/products-board/v1` | the board's `title`, `hardware`, `status` and `guides`; its `products`, each with the `files` of its `latest` release; and the `categories` and `fileTypes` those files use. `baseUrl` prefixes every file `path` |

Every worded field is `{ "zh", "en" }`, an unfilled language `""`. Every list
is in the order an admin set. A hidden board's document answers 404, and a
hidden product is absent from both documents while the devices that run it are
still served.

> status: shipped — evidence: `website/src/features/download/products-catalog.ts`, `website/worker/index.ts`

## What the website does with them

| Part of the site | Reads | Where |
|---|---|---|
| `GET /api/catalog` | the index, once per ten minutes, with a last good copy behind it | `website/worker/index.ts` |
| `GET /api/catalog/<board>` | that board's document, the same way; 404 for a board the catalogue does not list | `website/worker/index.ts` |
| The board cards of `/download/` | the index: its boards, and each board's newest version | `website/src/features/download/components/board-index.tsx` |
| A board's download page, `/download/<board>/` | served from one built template for any board the index lists, 404 for one it does not | `website/worker/index.ts` |
| The landing page's board table, a board page's hardware and status line | the index's boards, filled into the page's HTML when it is requested | `website/worker/pages.ts` |
| A board's download rows, their categories and forms, the filters, a product's wording and its recommended mark | the board's document | `website/src/features/download/download-map.ts` |
| A board's guides | the board's `guides`: a `doc` is linked in the page's language, a `url` as given | `website/src/features/download/components/board-guides.tsx` |
| A product's earlier releases | `releases`, then the release documents it names, in the browser, when a visitor opens the history | `website/src/features/download/products-catalog.ts` |

So a board, a product, a guide or a word an admin adds, hides or changes in res
shows on the site within the Worker's ten-minute cache, with no deploy.

Fallbacks, as the contract states them:

| Missing | Shown |
|---|---|
| a language of a worded field | the other language, then the identifier |
| a `fileTypes` row for a file's `kind` and `form` | the `kind` as its category, the `form` as its name |
| a `categories` row for a file type's `category` | the category's `id` |
| a guide's title in both languages | the guide is not shown |

res cannot know which documentation slugs this site publishes. The Worker
checks a guide's `doc` against the site's published documents: one that is not
published is left out, and named in the `status` of `/api/catalog/<board>`, so
an admin can find a stale slug.

A document that does not answer is never read as "nothing published": the
Worker goes on answering its last good copy. A page whose board wording cannot
be filled is served as built, and a board's page is still served when the
index cannot say which boards there are.

> status: shipped — evidence: `website/worker/pages.ts`, `website/src/features/download/download-map.ts`, `website/src/features/download/use-catalogue.ts`

## What is still the website's

The page copy — headings, column names, buttons — and the page templates. It
keeps no board, product, guide or file-type data.

> status: shipped — evidence: `website/src/shared/i18n/zh.ts`, `website/src/pages/download/board-page.astro`

## What comes next

Core components are released on their own, once per channel and
architecture. The index has their place: a core channel is a product of
`kind` `core` and no board, with its history. The download pages do not show
one; a core release belongs to a channel and an
architecture, not to a board, so it needs a place of its own on `/download/`.

> status: proposed — evidence: `website/src/features/download/products-catalog.ts`
