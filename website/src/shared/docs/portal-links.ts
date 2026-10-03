import type { LocaleCode } from '@/shared/i18n'

const TREE = 'https://github.com/micaoss/mica/tree/main/docs'
const BLOB = 'https://github.com/micaoss/mica/blob/main/docs'

function docs(locale: LocaleCode, slug: string): string {
  return locale === 'zh' ? `/docs/${slug}/` : `/${locale}/docs/${slug}/`
}

/** The portal's "start here" cards; all three are published, so all stay on site. */
export function quickHrefs(locale: LocaleCode): string[] {
  return [
    docs(locale, 'start/quickstart'),
    docs(locale, 'start/first-run'),
    docs(locale, 'integrate/applications'),
  ]
}

/**
 * The portal's seven section rows. The guides, hardware, security and release
 * pages are published; the rest resolves to the repository.
 */
export function sectionHrefs(locale: LocaleCode): string[] {
  return [
    `${BLOB}/architecture.md`,
    docs(locale, 'start/quickstart'),
    docs(locale, 'hardware'),
    docs(locale, 'security'),
    `${TREE}/reference`,
    docs(locale, 'releases/release-notes'),
    `${TREE}/decisions`,
  ]
}
