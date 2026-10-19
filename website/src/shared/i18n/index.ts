import { en } from './en'
import { zh } from './zh'

export const defaultLocale = 'zh'

export const locales = [
  { code: 'zh', label: zh.label },
  { code: 'en', label: en.label },
] as const

export type LocaleCode = (typeof locales)[number]['code']

/** The shape every locale dictionary satisfies. */
export type Copy = typeof zh

const DICTIONARIES: Record<LocaleCode, Copy> = { zh, en }

export function copyFor(locale: LocaleCode): Copy {
  return DICTIONARIES[locale]
}

/** Where each locale serves the equivalent of the given root-relative path. */
export function localePaths(path: string): Record<LocaleCode, string> {
  const clean = path.replace(/^\/+/, '')
  return {
    zh: `/${clean}`,
    en: `/en/${clean}`,
  }
}

/** Where each locale serves the page currently at `pathname`. */
export function localePathsFromUrl(pathname: string): Record<LocaleCode, string> {
  const root = pathname.replace(/^\/en(?=\/|$)/, '') || '/'
  return {
    zh: root,
    en: root === '/' ? '/en/' : `/en${root}`,
  }
}
