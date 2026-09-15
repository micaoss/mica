import { describe, expect, it } from 'vitest'
import { parseCatalog } from './catalog-schema'

const VALID = {
  board: 'x64',
  profile: 'dev',
  version: '2026.09-1',
  deploymentId: 'dep-aa11',
  kind: 'image',
  bytes: 1024,
  digest: 'sha256:aaaa',
  href: 'https://example.invalid/x64.img',
}

describe('parseCatalog', () => {
  it('accepts a well-formed catalogue', () => {
    expect(parseCatalog({ artifacts: [VALID] })).toEqual([VALID])
  })

  it('drops an entry rather than inventing a field it lacks', () => {
    const { digest, ...missingDigest } = VALID
    expect(parseCatalog({ artifacts: [missingDigest, VALID] })).toEqual([VALID])
  })

  it('drops an entry whose kind or profile is not one this site publishes', () => {
    expect(parseCatalog({ artifacts: [{ ...VALID, kind: 'iso' }] })).toEqual([])
    expect(parseCatalog({ artifacts: [{ ...VALID, profile: 'staging' }] })).toEqual([])
  })

  it('reads a bare array as well as the wrapped form', () => {
    expect(parseCatalog([VALID])).toEqual([VALID])
  })

  it('answers empty for anything it cannot read', () => {
    for (const input of [null, undefined, 42, 'text', {}, { artifacts: 'no' }])
      expect(parseCatalog(input)).toEqual([])
  })
})
