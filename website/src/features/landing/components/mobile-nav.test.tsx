import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { zh } from '@/shared/i18n/zh'
import { MobileNav } from './mobile-nav'

const links = [
  { href: '/download/', label: zh.nav.download },
  { href: '/docs/', label: zh.nav.docs },
]

describe('mobileNav', () => {
  it('keeps the navigation behind a labelled trigger until it is opened', () => {
    render(<MobileNav label={zh.nav.menu} closeLabel={zh.nav.close} links={links} />)

    expect(screen.getByRole('button', { name: zh.nav.menu })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: zh.nav.docs })).not.toBeInTheDocument()
  })

  it('opens on the trigger and lists every link', async () => {
    const user = userEvent.setup()
    render(<MobileNav label={zh.nav.menu} closeLabel={zh.nav.close} links={links} />)

    await user.click(screen.getByRole('button', { name: zh.nav.menu }))

    for (const link of links) {
      expect(await screen.findByRole('link', { name: link.label }))
        .toHaveAttribute('href', link.href)
    }
    expect(screen.getByRole('button', { name: zh.nav.close })).toBeInTheDocument()
  })
})
