import type { Download, DownloadKind } from './catalog'

/**
 * Turns `mica-build`'s GitHub releases into catalogue entries.
 *
 * A release is scoped to a board, tagged `<board>/<version>`. Its image assets
 * are named `mica-<board>-<product>-<version>.<ext>`, where the product is what
 * the page shows as the profile — `dev`, `minimal`, `prod` — and is not fixed
 * here: whatever the build publishes is what the page offers.
 *
 * Anything that does not parse is skipped rather than guessed at: a lock file,
 * a checksum list, or an asset whose name does not carry a board and product.
 */

export interface GithubAsset {
  name: string
  size: number
  digest?: string | null
  browser_download_url: string
}

export interface GithubRelease {
  tag_name: string
  published_at?: string | null
  draft?: boolean
  prerelease?: boolean
  assets: GithubAsset[]
}

/**
 * Extension to the form the page groups by. Firmware is missing on purpose: no
 * release has carried a firmware asset yet, so its naming is unknown and a rule
 * written now would be a guess. The page renders the form; this adds it when a
 * release shows what it is called.
 */
const KINDS: [RegExp, DownloadKind][] = [
  [/\.img(?:\.gz|\.xz|\.zst)?$/, 'image'],
  [/\.micaupd$/, 'update'],
]

function kindOf(filename: string): DownloadKind | null {
  return KINDS.find(([pattern]) => pattern.test(filename))?.[1] ?? null
}

/** `x64/20260915-1458` -> board and version. A tag without a scope is skipped. */
function scope(tag: string): { board: string, version: string } | null {
  const slash = tag.indexOf('/')
  if (slash <= 0 || slash === tag.length - 1)
    return null
  return { board: tag.slice(0, slash), version: tag.slice(slash + 1) }
}

/** `mica-x64-dev-20260915-1458.img` -> the product between board and version. */
function product(filename: string, board: string, version: string): string | null {
  const prefix = `mica-${board}-`
  const middle = `-${version}.`
  if (!filename.startsWith(prefix))
    return null
  const at = filename.indexOf(middle, prefix.length)
  if (at <= prefix.length - 1)
    return null
  const name = filename.slice(prefix.length, at)
  return name === '' ? null : name
}

export function downloadsFromReleases(releases: GithubRelease[]): Download[] {
  const downloads: Download[] = []

  for (const release of releases) {
    if (release.draft || release.prerelease)
      continue
    const scoped = scope(release.tag_name)
    if (!scoped)
      continue
    const releasedAt = release.published_at?.slice(0, 10)
    if (!releasedAt)
      continue

    for (const asset of release.assets) {
      const kind = kindOf(asset.name)
      const profile = product(asset.name, scoped.board, scoped.version)
      if (!kind || !profile || !asset.digest)
        continue

      downloads.push({
        board: scoped.board,
        profile,
        kind,
        version: scoped.version,
        releasedAt,
        bytes: asset.size,
        digest: asset.digest,
        href: asset.browser_download_url,
        filename: asset.name,
      })
    }
  }

  return downloads
}
