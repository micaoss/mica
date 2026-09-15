import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { DOC_GROUPS } from './src/shared/docs/published'
import { en } from './src/shared/i18n/en'
import { zh } from './src/shared/i18n/zh'

// The sidebar mirrors docs/user/, which is what the content contract's
// documentation brief specifies. Group labels come from the same dictionaries
// the rest of the site uses.
const sidebar = DOC_GROUPS.map(group => ({
  label: en.docs.groups[group.id],
  translations: { 'zh-CN': zh.docs.groups[group.id] },
  items: group.docs.map(doc => ({ slug: `docs/${doc.slug}` })),
}))

export default defineConfig({
  site: 'https://micaos.dev',
  integrations: [
    react(),
    starlight({
      title: { 'zh-CN': zh.docs.title, 'en': en.docs.title },
      defaultLocale: 'root',
      locales: {
        root: { label: zh.label, lang: 'zh-CN' },
        en: { label: en.label, lang: 'en' },
      },
      customCss: ['./src/styles/global.css'],
      favicon: '/favicon.svg',
      components: {
        Header: './src/components/starlight/Header.astro',
        ThemeProvider: './src/components/starlight/ThemeProvider.astro',
        ThemeSelect: './src/components/starlight/ThemeSelect.astro',
        Head: './src/components/starlight/Head.astro',
      },
      // NOTE: expressiveCode.styleOverrides is deliberately not used. Setting it
      // makes astro-expressive-code emit a stylesheet whose hash no longer
      // matches the one the rendered HTML links to, so the code-block styles
      // 404 in the built site. The same styling is applied through the
      // --ec-* custom properties in src/styles/global.css instead.
      sidebar,
      disable404Route: true,
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  server: {
    host: true,
    // nsl fronts the dev server on both *.localhost and a public dev domain, and
    // that domain is not fixed. See docs/decisions/2026-09-14-dev-allowed-hosts.md.
    allowedHosts: true,
  },
})
