import type { LocaleCode } from '../src/shared/i18n'
/**
 * Copies the allowlisted documentation into `src/content/docs/` for Starlight,
 * lifting each H1 into frontmatter and rewriting links on the way. Upstream is
 * read-only; the transformations are unit-tested in `shared/docs/transform.ts`.
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { PUBLISHED_DOCS, SLUG_BY_SOURCE } from '../src/shared/docs/published'
import { frontmatter, rewriteLinks, takeTitle } from '../src/shared/docs/transform'
import { locales } from '../src/shared/i18n'

// The documentation is a sibling directory in this repository.
const DOCS_ROOT = resolve(process.env.MICA_DOCS_ROOT ?? '../docs')
const OUT_ROOT = resolve('src/content/docs')

function outputPath(locale: LocaleCode, slug: string): string {
  return locale === 'zh'
    ? join(OUT_ROOT, 'docs', `${slug}.md`)
    : join(OUT_ROOT, locale, 'docs', `${slug}.md`)
}

async function listUpstreamPaths(dir: string, base = dir): Promise<Set<string>> {
  const found = new Set<string>()
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.add(`${relative(base, full)}/`)
      for (const nested of await listUpstreamPaths(full, base)) found.add(nested)
    }
    else {
      found.add(relative(base, full))
    }
  }
  return found
}

async function main(): Promise<void> {
  if (!existsSync(DOCS_ROOT)) {
    console.error(
      `documentation not found at ${DOCS_ROOT}\n`
      + 'set MICA_DOCS_ROOT to point at it',
    )
    process.exit(1)
  }

  const upstreamPaths = await listUpstreamPaths(DOCS_ROOT)
  const problems: string[] = []
  let written = 0
  let internal = 0
  let external = 0

  await rm(OUT_ROOT, { recursive: true, force: true })

  for (const doc of PUBLISHED_DOCS) {
    for (const { code: locale } of locales) {
      const source = doc.sources[locale]
      if (!source)
        continue

      if (!upstreamPaths.has(source)) {
        problems.push(`${doc.slug}: allowlisted source is missing upstream: ${source}`)
        continue
      }

      const raw = await readFile(join(DOCS_ROOT, source), 'utf8')
      let title: string
      let body: string
      try {
        ({ title, body } = takeTitle(raw))
      }
      catch (error) {
        problems.push(`${source}: ${(error as Error).message}`)
        continue
      }

      const result = rewriteLinks(body, {
        sourcePath: source,
        locale,
        slugBySource: SLUG_BY_SOURCE,
        upstreamPaths,
      })
      problems.push(...result.problems)
      internal += result.internal
      external += result.external

      const destination = outputPath(locale, doc.slug)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, frontmatter(title) + result.body.trimStart())
      written += 1
    }
  }

  console.log(
    `prepared ${written} document(s) from ${DOCS_ROOT}\n`
    + `  ${internal} link(s) kept on the site, ${external} sent to the repository`,
  )

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`)
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
}

await main()
