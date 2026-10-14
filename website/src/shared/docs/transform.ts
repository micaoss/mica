import type { LocaleCode } from '@/shared/i18n'

export const BLOB_BASE = 'https://github.com/micaoss/mica/blob/main/docs'

/** Root locale is served without a URL prefix. */
export function siteUrl(locale: LocaleCode, slug: string): string {
  return locale === 'zh' ? `/docs/${slug}/` : `/${locale}/docs/${slug}/`
}

/** Starlight renders the title itself, so the H1 moves to frontmatter. */
export function takeTitle(markdown: string): { title: string, body: string } {
  const lines = markdown.split('\n')
  const index = lines.findIndex(line => line.startsWith('# '))
  if (index === -1)
    throw new Error('no H1 heading to use as the page title')

  const title = lines[index].slice(2).trim()
  lines.splice(index, 1)
  if (lines[index]?.trim() === '')
    lines.splice(index, 1)

  return { title, body: lines.join('\n') }
}

export interface LinkContext {
  /** Path of the document being rewritten, relative to the docs root. */
  sourcePath: string
  locale: LocaleCode
  /** Upstream path -> published slug. */
  slugBySource: ReadonlyMap<string, string>
  /** Every path that exists upstream; directories end with a slash. */
  upstreamPaths: ReadonlySet<string>
}

export interface RewriteResult {
  body: string
  problems: string[]
  /** Links that resolved to a page on this site. */
  internal: number
  /** Links that resolved to the repository. */
  external: number
}

const LINK = /(\]\()([^)\s]+)(\))/g
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i

function normalise(path: string): string {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.')
      continue
    if (segment === '..') {
      if (segments.length === 0)
        return '..'
      segments.pop()
    }
    else {
      segments.push(segment)
    }
  }
  return segments.join('/') + (path.endsWith('/') ? '/' : '')
}

/**
 * Published target -> site URL, unpublished but existing -> repository URL,
 * missing -> reported as a problem.
 */
export function rewriteLinks(body: string, context: LinkContext): RewriteResult {
  const { sourcePath, locale, slugBySource, upstreamPaths } = context
  const problems: string[] = []
  let internal = 0
  let external = 0

  const directory = sourcePath.includes('/')
    ? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
    : ''

  const rewritten = body.replace(LINK, (whole, open: string, target: string, close: string) => {
    if (ABSOLUTE.test(target))
      return whole

    const hashAt = target.indexOf('#')
    const path = hashAt === -1 ? target : target.slice(0, hashAt)
    const anchor = hashAt === -1 ? '' : target.slice(hashAt)
    if (!path)
      return whole

    const resolved = normalise(directory ? `${directory}/${path}` : path)
    if (resolved.startsWith('..')) {
      problems.push(`${sourcePath}: link escapes the documentation root: ${target}`)
      return whole
    }

    const slug = slugBySource.get(resolved)
    if (slug) {
      internal += 1
      return `${open}${siteUrl(locale, slug)}${anchor}${close}`
    }

    const asDirectory = resolved.endsWith('/') ? resolved : `${resolved}/`
    if (!upstreamPaths.has(resolved) && !upstreamPaths.has(asDirectory)) {
      problems.push(`${sourcePath}: link target does not exist upstream: ${target}`)
      return whole
    }

    external += 1
    return `${open}${BLOB_BASE}/${resolved}${anchor}${close}`
  })

  return { body: rewritten, problems, internal, external }
}

export function frontmatter(title: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\n---\n\n`
}
