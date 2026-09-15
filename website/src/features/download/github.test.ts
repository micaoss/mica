import type { GithubRelease } from './github'
import { describe, expect, it } from 'vitest'
import { downloadsFromReleases } from './github'

function release(partial: Partial<GithubRelease>): GithubRelease {
  return {
    tag_name: 'x64/20260915-1458',
    published_at: '2026-09-15T14:58:00Z',
    assets: [],
    ...partial,
  }
}

function asset(name: string, size = 1024) {
  return {
    name,
    size,
    digest: 'sha256:abc',
    browser_download_url: `https://github.com/micaoss/mica-build/releases/download/x64/20260915-1458/${name}`,
  }
}

describe('downloadsFromReleases', () => {
  it('reads the board and version from the scoped tag', () => {
    const [entry] = downloadsFromReleases([
      release({ assets: [asset('mica-x64-dev-20260915-1458.img')] }),
    ])

    expect(entry).toMatchObject({
      board: 'x64',
      profile: 'dev',
      kind: 'image',
      version: '20260915-1458',
      releasedAt: '2026-09-15',
      filename: 'mica-x64-dev-20260915-1458.img',
      digest: 'sha256:abc',
    })
  })

  it('takes the product from the asset name, whatever it is', () => {
    const entries = downloadsFromReleases([
      release({
        assets: [
          asset('mica-x64-dev-20260915-1458.img'),
          asset('mica-x64-minimal-20260915-1458.img'),
        ],
      }),
    ])

    expect(entries.map(entry => entry.profile)).toEqual(['dev', 'minimal'])
  })

  it('reads the form from the extension, compressed or not', () => {
    const entries = downloadsFromReleases([
      release({
        assets: [
          asset('mica-x64-dev-20260915-1458.img.gz'),
          asset('mica-x64-dev-20260915-1458.micaupd'),
        ],
      }),
    ])

    expect(entries.map(entry => entry.kind)).toEqual(['image', 'update'])
  })

  it('skips what is not a download: locks, checksums, unnamed assets', () => {
    const entries = downloadsFromReleases([
      release({
        assets: [
          asset('mica-build.lock'),
          asset('SHA256SUMS'),
          asset('mica-x64-dev-20260915-1458.img'),
        ],
      }),
    ])

    expect(entries).toHaveLength(1)
  })

  it('skips an asset with no digest rather than publishing one unverifiable', () => {
    const entries = downloadsFromReleases([
      release({
        assets: [{ ...asset('mica-x64-dev-20260915-1458.img'), digest: null }],
      }),
    ])

    expect(entries).toEqual([])
  })

  it('skips drafts, prereleases and unscoped or unpublished tags', () => {
    expect(downloadsFromReleases([
      release({ draft: true, assets: [asset('mica-x64-dev-20260915-1458.img')] }),
      release({ prerelease: true, assets: [asset('mica-x64-dev-20260915-1458.img')] }),
      release({ tag_name: '20260915-1458', assets: [asset('mica-x64-dev-20260915-1458.img')] }),
      release({ published_at: null, assets: [asset('mica-x64-dev-20260915-1458.img')] }),
    ])).toEqual([])
  })
})
