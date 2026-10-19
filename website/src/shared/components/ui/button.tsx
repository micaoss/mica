import type { VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'
import { cn } from 'cn'

// Fumadocs language: primary is near-black, `accent` the translucent hover wash.
const buttonVariants = cva(
  'group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent text-sm leading-5 font-medium whitespace-nowrap no-underline transition-colors outline-none select-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
      },
      size: {
        default: 'h-9 px-3.5',
        ghost: 'h-9 px-2.5',
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'secondary',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

/** A plain anchor wearing the button's classes, so it keeps link semantics. */
function ButtonLink({
  className,
  variant = 'secondary',
  size = 'default',
  ...props
}: React.ComponentProps<'a'> & VariantProps<typeof buttonVariants>) {
  return (
    <a
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, ButtonLink, buttonVariants }
