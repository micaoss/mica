import { Menu } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/components/ui/drawer'

export interface MobileNavProps {
  /** Accessible name for the trigger, and the drawer's title. */
  label: string
  closeLabel: string
  links: { href: string, label: string }[]
}

/** The narrow-viewport navigation; the design bundle has no mobile layout. */
export function MobileNav({ label, closeLabel, links }: MobileNavProps) {
  return (
    <Drawer swipeDirection="right">
      <DrawerTrigger
        render={(
          <Button variant="ghost" size="icon" aria-label={label} className="border-0 text-foreground" />
        )}
      >
        <Menu className="size-[17px]" strokeWidth={1.5} aria-hidden="true" />
      </DrawerTrigger>

      <DrawerContent className="w-[min(20rem,85vw)] border-l border-border bg-background">
        <DrawerTitle className="border-b border-border px-5 py-4 text-sm font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </DrawerTitle>

        <nav className="flex flex-col">
          {links.map(link => (
            <DrawerClose
              key={link.href}
              render={<a href={link.href} />}
              className="border-b border-border px-5 py-4 text-left text-base text-foreground no-underline transition-colors hover:bg-accent hover:no-underline"
            >
              {link.label}
            </DrawerClose>
          ))}
        </nav>

        <DrawerClose
          render={<Button variant="secondary" />}
          className="m-5 text-[15px]"
        >
          {closeLabel}
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  )
}
