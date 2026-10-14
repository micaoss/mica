import type { BoardCatalogue } from '../products-catalog'
import type { Copy } from '@/shared/i18n'
import { docsPageHref } from '@/features/landing/links'
import { Card, CardContent } from '@/shared/components/ui/card'
import { wordIn } from '../download-map'
import { docSlug, outsideUrl } from '../products-catalog'
import { useBoard } from '../use-catalogue'

/**
 * The documents a board's page links to. Which they are, in what order and
 * what each is called is the resource service's; a guide names a document of
 * this site by its slug, or an outside target by its URL.
 */
export function BoardGuides({
  copy,
  board,
  catalogue,
}: {
  copy: Copy
  board: string
  /** Given in tests; in the page the board is fetched from the endpoint. */
  catalogue?: BoardCatalogue
}) {
  const { data } = useBoard(board, catalogue)
  const guides = (data?.guides ?? []).flatMap((guide) => {
    const title = wordIn(guide.title, copy.locale)
    const doc = docSlug(guide.doc)
    // Checked here too: a copy this browser kept does not pass the Worker again.
    const href = doc ? docsPageHref(copy.locale, doc) : outsideUrl(guide.url)
    return title && href ? [{ title, body: wordIn(guide.body, copy.locale), href }] : []
  })

  if (guides.length === 0)
    return null

  return (
    <section className="border-t border-border py-14">
      <h2 className="m-0 text-[clamp(22px,3vw,28px)] leading-[1.2] font-semibold tracking-tight">
        {copy.download.guides.heading}
      </h2>
      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
        {guides.map(guide => (
          <a key={guide.href} href={guide.href} className="group block text-foreground no-underline hover:no-underline">
            <Card className="h-full gap-0 p-6 transition-colors group-hover:border-ring">
              <CardContent className="p-0">
                <h3 className="m-0 text-lg leading-6 font-semibold tracking-tight">{guide.title}</h3>
                {guide.body && (
                  <p className="mt-2.5 mb-0 text-[15px] leading-7 text-muted-foreground">{guide.body}</p>
                )}
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </section>
  )
}
