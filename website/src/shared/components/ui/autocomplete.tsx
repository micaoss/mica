import type * as React from 'react'
import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete'
import { cn } from 'cn'

// Not in the shadcn registry: a thin wrapper over the Base UI primitive,
// following the registry's conventions.

const Autocomplete = AutocompletePrimitive.Root

function AutocompleteInput({ className, ...props }: AutocompletePrimitive.Input.Props) {
  return (
    <AutocompletePrimitive.Input
      data-slot="autocomplete-input"
      className={cn(
        'min-h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground caret-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...props}
    />
  )
}

function AutocompleteContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: AutocompletePrimitive.Popup.Props & Pick<AutocompletePrimitive.Positioner.Props, 'sideOffset'>) {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner sideOffset={sideOffset} className="isolate z-50">
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-content"
          className={cn(
            'max-h-[min(24rem,var(--available-height))] w-(--anchor-width) overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md transition-[opacity,transform] duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
            className,
          )}
          {...props}
        >
          {children}
        </AutocompletePrimitive.Popup>
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  )
}

function AutocompleteList({ className, ...props }: AutocompletePrimitive.List.Props) {
  return (
    <AutocompletePrimitive.List
      data-slot="autocomplete-list"
      className={cn('flex flex-col', className)}
      {...props}
    />
  )
}

function AutocompleteItem({ className, ...props }: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(
        'cursor-default border-b border-border px-3 py-2.5 text-left outline-none transition-colors last:border-b-0 data-highlighted:bg-accent data-highlighted:text-accent-foreground',
        className,
      )}
      {...props}
    />
  )
}

function AutocompleteEmpty({ className, ...props }: AutocompletePrimitive.Empty.Props) {
  return (
    <AutocompletePrimitive.Empty
      data-slot="autocomplete-empty"
      className={cn('px-3 py-2.5 text-sm text-muted-foreground empty:hidden', className)}
      {...props}
    />
  )
}

function AutocompleteStatus({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="autocomplete-status"
      role="status"
      aria-live="polite"
      className={cn('px-3 py-2.5 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus,
}
