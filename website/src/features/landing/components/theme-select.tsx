import type { ThemeMode } from '@/shared/hooks/use-theme-mode'
import { Moon, Sun, SunMoon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { themeModes, useThemeMode } from '@/shared/hooks/use-theme-mode'

const ICONS = { auto: SunMoon, light: Sun, dark: Moon }

export interface ThemeSelectProps {
  /** Accessible name for the control. */
  label: string
  labels: Record<ThemeMode, string>
}

export function ThemeSelect({ label, labels }: ThemeSelectProps) {
  const { mode, selectMode } = useThemeMode()
  const items = themeModes.map(value => ({ value, label: labels[value] }))
  const Icon = ICONS[mode]

  return (
    <Select
      items={items}
      value={mode}
      onValueChange={(value: string | null) => {
        if (value)
          selectMode(value as ThemeMode)
      }}
    >
      {/* The icon carries the mode; the label is for screen readers only. */}
      <SelectTrigger aria-label={label} className="flex-none gap-1 border-transparent bg-transparent px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground">
        <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
        <SelectValue className="sr-only" />
      </SelectTrigger>
      <SelectContent className="w-auto min-w-0">
        {themeModes.map((value) => {
          const ItemIcon = ICONS[value]
          return (
            <SelectItem key={value} value={value}>
              <ItemIcon className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {labels[value]}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
