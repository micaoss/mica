import type { Copy } from '@/shared/i18n'
import { BrandWordmark } from '@/shared/components/brand-mark'
import { GITHUB_ORG_URL } from '../links'

export function SiteFooter({ copy }: { copy: Copy }) {
  return (
    <footer className="flex flex-wrap items-center gap-4 pt-8 pb-14 text-[13px] text-muted-foreground">
      <BrandWordmark className="h-4 opacity-75" />
      <span className="min-w-3 flex-1" />
      <span>{copy.footer.license}</span>
      <a href={GITHUB_ORG_URL}>{copy.footer.repo}</a>
    </footer>
  )
}
