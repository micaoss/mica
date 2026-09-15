import type { Copy } from '@/shared/i18n'
import { Card, CardContent } from '@/shared/components/ui/card'
import { SectionHeading } from './section-heading'

/**
 * Colour marks the responsibility group, not the layer: 03 and 02 share one, and
 * the brand blue appears once. `Card` outlines with a `ring`, so the group
 * colour replaces its default.
 */
const GROUPS: Record<string, { band: string, no: string }> = {
  '05': { band: 'ring-brand/70 shadow-brand/25', no: 'text-brand' },
  '04': { band: 'ring-foreground/25 shadow-foreground/15', no: 'text-foreground/50' },
  '03': { band: 'ring-foreground/40 shadow-foreground/15', no: 'text-foreground/65' },
  '02': { band: 'ring-foreground/40 shadow-foreground/15', no: 'text-foreground/65' },
  '01': { band: 'ring-foreground/55 shadow-foreground/20', no: 'text-foreground/85' },
}

export function ArchitectureSection({ copy }: { copy: Copy }) {
  const layers = copy.arch.layers

  return (
    <section className="py-16">
      <SectionHeading>{copy.why.heading}</SectionHeading>

      <div className="mt-12">
        {/* The management plane and the board contract span; the three system
          layers share the row between them. One column below `sm`. */}
        <div className="grid gap-4 sm:grid-cols-3">
          {layers.map((layer, index) => {
            const spansRow = index === 0 || index === layers.length - 1
            // Both strings are written out for Tailwind to find them.
            const points = layer.points ?? []
            const bulletCols = spansRow
              ? (points.length === 3 ? 'sm:grid-cols-3 sm:gap-x-8' : 'sm:grid-cols-2 sm:gap-x-8')
              : ''
            const group = GROUPS[layer.no]
            return (
              <Card
                key={layer.no}
                className={`gap-0 p-6 shadow-xl ${group.band} ${spansRow ? 'sm:col-span-3' : ''}`}
              >
                <CardContent className="flex h-full flex-col p-0">
                  {/* The number is a rung: its own line over a rule. */}
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`font-mono text-xs tabular-nums ${group.no}`}>
                      {layer.no}
                    </span>
                    <span aria-hidden="true" className="h-px flex-1 bg-border" />
                    <span className="font-mono text-xs text-muted-foreground">{layer.impl}</span>
                  </div>

                  <h3 className="text-xl leading-7 font-semibold tracking-tight text-balance">
                    {layer.name}
                  </h3>
                  <p className="mt-2.5 mb-0 text-[15px] leading-7 text-muted-foreground">
                    {layer.desc}
                  </p>

                  {points.length > 0 && (
                    <ul
                      className={`mt-5 grid list-none gap-2 p-0 ${layer.desc ? 'border-t border-border pt-4' : ''} ${bulletCols}`}
                    >
                      {points.map(point => (
                        <li key={point} className="text-sm leading-6 text-muted-foreground">
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
