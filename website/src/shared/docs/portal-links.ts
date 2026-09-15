import type { LocaleCode } from '@/shared/i18n'

const TREE = 'https://github.com/micaoss/mica/tree/main/docs'
const BLOB = 'https://github.com/micaoss/mica/blob/main/docs'

function docs(locale: LocaleCode, slug: string): string {
  return locale === 'zh' ? `/docs/${slug}/` : `/${locale}/docs/${slug}/`
}

/** The portal's "start here" cards; all three are published, so all stay on site. */
export function quickHrefs(locale: LocaleCode): string[] {
  return [
    docs(locale, 'user/quickstart'),
    docs(locale, 'user/first-run'),
    docs(locale, 'user/applications'),
  ]
}

/**
 * The portal's seven section rows. Only the user documentation is published, so
 * the engineering record resolves to the repository.
 */
export function sectionHrefs(locale: LocaleCode): string[] {
  return [
    `${BLOB}/architecture.md`,
    docs(locale, 'user/quickstart'),
    `${TREE}/boards`,
    `${TREE}/design`,
    `${TREE}/decisions`,
    `${TREE}/task`,
    `${BLOB}/changelog.md`,
  ]
}
