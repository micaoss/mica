import type { LocaleCode } from '@/shared/i18n'
import allowlist from '../../../published-docs.json'

/**
 * The allowlist of documents this website publishes, read from
 * `published-docs.json`. A file is published by appearing there, never by
 * existing under `../docs`.
 */
export interface PublishedDoc {
  /** Path under `/docs/`, without extension. */
  slug: string
  /** Upstream path relative to the documentation root, per locale. */
  sources: Partial<Record<LocaleCode, string>>
}

export type GroupId = 'start' | 'hardware' | 'operating' | 'trouble' | 'reference'

export interface DocGroup {
  /** Key into `Copy['docs']['groups']` for the heading. */
  id: GroupId
  docs: PublishedDoc[]
}

/** One entry of the allowlist file. */
interface AllowlistDoc {
  name: string
  /** The directory under the documentation root; `user` when the entry omits it. */
  dir?: string
  /** The site slug, when it should not be `<dir>/<name>`. */
  slug?: string
  locales?: readonly string[]
}

/**
 * Resolves one entry to its sources. English is `<dir>/<name>.md` and Chinese
 * `zh/<dir>/<name>.md`, which is how `docs/` lays out every translated tree,
 * so a tree is published by being named here and nowhere else.
 */
function sourceDoc(entry: AllowlistDoc): PublishedDoc {
  const { name, dir = 'user', slug = `${dir}/${name}`, locales = ['zh', 'en'] } = entry
  const sources: Partial<Record<LocaleCode, string>> = {}
  if (locales.includes('en'))
    sources.en = `${dir}/${name}.md`
  if (locales.includes('zh'))
    sources.zh = `zh/${dir}/${name}.md`
  return { slug, sources }
}

export const DOC_GROUPS: DocGroup[] = allowlist.groups.map(group => ({
  id: group.id as GroupId,
  docs: group.docs.map(doc => sourceDoc(doc as AllowlistDoc)),
}))

export const PUBLISHED_DOCS: PublishedDoc[] = DOC_GROUPS.flatMap(group => group.docs)

/** Upstream path -> site slug, for rewriting links between documents. */
export const SLUG_BY_SOURCE: ReadonlyMap<string, string> = new Map(
  PUBLISHED_DOCS.flatMap(doc =>
    Object.values(doc.sources).map(source => [source, doc.slug] as const),
  ),
)
