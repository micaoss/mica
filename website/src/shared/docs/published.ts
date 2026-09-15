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

export type GroupId = 'start' | 'operating' | 'trouble' | 'reference'

export interface DocGroup {
  /** Key into `Copy['docs']['groups']` for the heading. */
  id: GroupId
  docs: PublishedDoc[]
}

/** Every entry names a document under `docs/user/`, in Chinese and English unless narrowed. */
function userDoc(name: string, locales: readonly LocaleCode[] = ['zh', 'en']): PublishedDoc {
  const sources: Partial<Record<LocaleCode, string>> = {}
  if (locales.includes('en'))
    sources.en = `user/${name}.md`
  if (locales.includes('zh'))
    sources.zh = `zh/user/${name}.md`
  return { slug: `user/${name}`, sources }
}

export const DOC_GROUPS: DocGroup[] = allowlist.groups.map(group => ({
  id: group.id as GroupId,
  docs: group.docs.map(doc =>
    userDoc(doc.name, 'locales' in doc ? (doc.locales as LocaleCode[]) : undefined),
  ),
}))

export const PUBLISHED_DOCS: PublishedDoc[] = DOC_GROUPS.flatMap(group => group.docs)

/** Upstream path -> site slug, for rewriting links between documents. */
export const SLUG_BY_SOURCE: ReadonlyMap<string, string> = new Map(
  PUBLISHED_DOCS.flatMap(doc =>
    Object.values(doc.sources).map(source => [source, doc.slug] as const),
  ),
)
