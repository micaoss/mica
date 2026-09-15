/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config'

export default getViteConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/content.config.ts',
        // Registry output. Its behaviour is the registry's and Base UI's to
        // guarantee; what we changed is Tailwind classes, which the components
        // that consume these are already exercising. Testing them here would be
        // testing shadcn, not this site.
        'src/shared/components/ui/**',
      ],
    },
  },
})
