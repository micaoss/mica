import type { Copy } from '@/shared/i18n'
import { SectionHeading } from './section-heading'

export function FlowSection({ copy }: { copy: Copy }) {
  const steps = copy.flow.steps

  return (
    <section className="py-16">
      <SectionHeading>{copy.flow.heading}</SectionHeading>
      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(step => (
          <div key={step.no}>
            <span className="font-mono text-sm text-brand-strong tabular-nums">{step.no}</span>
            <h3 className="mt-2 text-base leading-6 font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-2 mb-0 text-sm leading-6 text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
