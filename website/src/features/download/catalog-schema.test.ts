import { describe, expect, it } from 'vitest'
import { isSample, parseCatalog } from './catalog-schema'

const VALID = {
  board: 'x64',
  profile: 'dev',
  kind: 'image',
  version: '2026.09-1',
  deploymentId: 'dep-aa11',
  releasedAt: '2026-09-01',
  bytes: 1024,
  digest: 'sha256:aaaa',
  href: 'https://example.invalid/x64.img',
  filename: 'disk.img',
}

describe('parseCatalog', () => {
  it('accepts a well-formed catalogue', () => {
    expect(parseCatalog({ downloads: [VALID] })).toEqual([VALID])
  })

  it('drops an entry rather than inventing a field it lacks', () => {
    const { digest: _digest, ...missingDigest } = VALID
    expect(parseCatalog({ downloads: [missingDigest, VALID] })).toEqual([VALID])
  })

  it('drops an entry with no release date to order it by', () => {
    const { releasedAt: _releasedAt, ...undated } = VALID
    expect(parseCatalog({ downloads: [undated] })).toEqual([])
  })

  it('drops a form this site does not publish', () => {
    expect(parseCatalog({ downloads: [{ ...VALID, kind: 'kernel' }] })).toEqual([])
    expect(parseCatalog({ downloads: [{ ...VALID, profile: 'staging' }] })).toEqual([])
  })

  it('reads a bare array as well as the wrapped form', () => {
    expect(parseCatalog([VALID])).toEqual([VALID])
  })

  it('answers empty for anything it cannot read', () => {
    for (const input of [null, undefined, 42, 'text', {}, { downloads: 'no' }])
      expect(parseCatalog(input)).toEqual([])
  })
})

describe('isSample', () => {
  it('is true only when the payload says so', () => {
    expect(isSample({ downloads: [], sample: true })).toBe(true)
    expect(isSample({ downloads: [] })).toBe(false)
    expect(isSample(null)).toBe(false)
  })
})
