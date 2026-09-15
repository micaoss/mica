import type { ReactNode } from 'react'
import { Separator } from '@/shared/components/ui/separator'

/**
 * Opens a section: the heading centred on the measure with a rule running out
 * to either side.
 */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-6">
      <Separator className="w-auto flex-1 bg-border" />
      <h2 className="m-0 max-w-[26ch] text-center text-3xl font-semibold tracking-tight text-balance">
        {children}
      </h2>
      <Separator className="w-auto flex-1 bg-border" />
    </div>
  )
}
