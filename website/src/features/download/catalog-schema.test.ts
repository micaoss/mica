import { describe, expect, it } from 'vitest'
import { isSample, parseCatalog } from './catalog-schema'

const VALID = {
  board: 'x64',
  profile: 'dev',
  version: '2026.09-1',
  deploymentId: 'dep-aa11',
  releasedAt: '2026-09-01',
  bytes: 1024,
  digest: 'sha256:aaaa',
  href: 'https://example.invalid/x64.img',
}

describe('parseCatalog', () => {
  it('accepts a well-formed catalogue', () => {
    expect(parseCatalog({ images: [VALID] })).toEqual([VALID])
  })

  it('drops an entry rather than inventing a field it lacks', () => {
    const { digest: _digest, ...missingDigest } = VALID
    expect(parseCatalog({ images: [missingDigest, VALID] })).toEqual([VALID])
  })

  it('drops an entry with no release date to order it by', () => {
    const { releasedAt: _releasedAt, ...undated } = VALID
    expect(parseCatalog({ images: [undated] })).toEqual([])
  })

  it('drops an entry whose profile is not one this site publishes', () => {
    expect(parseCatalog({ images: [{ ...VALID, profile: 'staging' }] })).toEqual([])
  })

  it('reads a bare array as well as the wrapped form', () => {
    expect(parseCatalog([VALID])).toEqual([VALID])
  })

  it('answers empty for anything it cannot read', () => {
    for (const input of [null, undefined, 42, 'text', {}, { images: 'no' }])
      expect(parseCatalog(input)).toEqual([])
  })
})

describe('isSample', () => {
  it('is true only when the payload says so', () => {
    expect(isSample({ images: [], sample: true })).toBe(true)
    expect(isSample({ images: [] })).toBe(false)
    expect(isSample(null)).toBe(false)
  })
})
