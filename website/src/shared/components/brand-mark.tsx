import { cn } from 'cn'

// Both variants render; CSS picks one. That keeps the marks correct through a
// theme change without making them a hydrated island.
export function BrandIcon({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/assets/mica-os-icon.svg"
        alt=""
        className={cn('block size-[26px] dark:hidden', className)}
      />
      <img
        src="/assets/mica-os-icon-dark.svg"
        alt=""
        className={cn('hidden size-[26px] dark:block', className)}
      />
    </>
  )
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/assets/mica-os-wordmark.svg"
        alt="Mica OS"
        className={cn('block h-5 w-auto dark:hidden', className)}
      />
      <img
        src="/assets/mica-os-wordmark-dark.svg"
        alt="Mica OS"
        className={cn('hidden h-5 w-auto dark:block', className)}
      />
    </>
  )
}
