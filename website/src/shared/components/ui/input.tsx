import type * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { cn } from 'cn'

// Colours restated on the Fumadocs token set; shape and API are the registry's.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'min-h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground caret-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
