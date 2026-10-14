import type { Copy } from '@/shared/i18n'
import { ButtonLink } from '@/shared/components/ui/button'

export function HeroSection({ copy, docsHref, downloadHref }: { copy: Copy, docsHref: string, downloadHref: string }) {
  return (
    <section className="flex flex-col items-center pt-20 pb-16 text-center sm:pt-28">
      {/* text-balance, not a hand-split: splitting dropped the space in English. */}
      <h1 className="m-0 max-w-[24ch] text-[clamp(32px,6vw,56px)] leading-[1.15] font-semibold text-balance tracking-tight">
        {copy.hero.title}
      </h1>
      <p className="mt-6 mb-0 max-w-[84ch] text-base leading-7 text-balance text-muted-foreground">
        {copy.hero.sub}
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <ButtonLink variant="primary" href={docsHref}>{copy.hero.cta1}</ButtonLink>
        <ButtonLink variant="secondary" href={downloadHref}>{copy.hero.cta2}</ButtonLink>
      </div>
    </section>
  )
}
