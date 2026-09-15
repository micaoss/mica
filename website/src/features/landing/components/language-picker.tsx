import type { LocaleCode } from '@/shared/i18n'
import { Globe } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { locales } from '@/shared/i18n'

const ITEMS = locales.map(locale => ({ value: locale.code, label: locale.label }))

export interface LanguagePickerProps {
  locale: LocaleCode
  label: string
  /** Where each locale serves the current page. */
  paths: Record<LocaleCode, string>
}

export function LanguagePicker({ locale, label, paths }: LanguagePickerProps) {
  return (
    <Select
      items={ITEMS}
      value={locale}
      onValueChange={(value: string | null) => {
        // Locale is a route, so switching is navigation.
        if (value && value !== locale)
          window.location.href = paths[value as LocaleCode]
      }}
    >
      <SelectTrigger aria-label={label} className="flex-none gap-1 border-transparent bg-transparent px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground">
        <Globe className="size-4" strokeWidth={1.5} aria-hidden="true" />
        {/* The page itself shows the language, so the label is for screen
            readers only. */}
        <SelectValue className="sr-only" />
      </SelectTrigger>
      <SelectContent className="w-auto min-w-0">
        {ITEMS.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
