import type { Copy } from '@/shared/i18n'
import { ButtonLink } from '@/shared/components/ui/button'
import { GITHUB_ORG_URL } from '../links'

export function StartSection({ copy, docsHref }: { copy: Copy, docsHref: string }) {
  return (
    <section className="flex flex-col items-center border-t border-border py-20 text-center">
      <h2 className="m-0 max-w-[20ch] text-[clamp(26px,4vw,36px)] leading-[1.2] font-semibold tracking-tight">
        {copy.start.heading}
      </h2>
      <p className="mt-5 mb-0 max-w-[84ch] text-[15px] leading-7 text-balance text-muted-foreground">
        {copy.start.body}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink variant="primary" href={docsHref}>{copy.nav.docs}</ButtonLink>
        <ButtonLink variant="secondary" href={GITHUB_ORG_URL}>GitHub</ButtonLink>
      </div>
    </section>
  )
}
