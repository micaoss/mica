import type { LocaleCode } from '@/shared/i18n'

export const SUPPORT_TIERS_URL = 'https://github.com/micaoss/mica/blob/main/docs/boards/support-tiers.md'
export const NEW_ISSUE_URL = 'https://github.com/micaoss/mica/issues/new'
export const GITHUB_ORG_URL = 'https://github.com/micaoss'

/** The landing page for a locale. `zh` is the root locale and carries no prefix. */
export function homeHref(locale: LocaleCode): string {
  return locale === 'zh' ? '/' : `/${locale}/`
}

/** The documentation portal for a locale. */
export function docsHref(locale: LocaleCode): string {
  return locale === 'zh' ? '/docs/' : `/${locale}/docs/`
}

/** The download page for a locale. */
export function downloadHref(locale: LocaleCode): string {
  return locale === 'zh' ? '/download/' : `/${locale}/download/`
}

/** A published documentation page, by its slug under `/docs/`. */
export function docsPageHref(locale: LocaleCode, slug: string): string {
  return `${docsHref(locale)}${slug}/`
}
