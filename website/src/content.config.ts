import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { defineCollection } from 'astro:content'

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Starlight ships complete zh-CN and en UI strings; these files are empty
  // overrides, kept as the obvious place for a wording change.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
}
