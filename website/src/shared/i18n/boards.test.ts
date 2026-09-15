import { describe, expect, it } from 'vitest'
import { en } from './en'
import { zh } from './zh'

describe('the board list', () => {
  // Each locale generates its own /download/<board>/ routes from this list, so a
  // board that differs between them is a page that exists in one language only —
  // and nothing else would report it.
  it('names the same boards in both locales, in the same order', () => {
    expect(en.boards.rows.map(row => row.board)).toEqual(zh.boards.rows.map(row => row.board))
  })

  it('gives every board an identifier usable as a URL segment', () => {
    for (const row of zh.boards.rows)
      expect(row.board).toMatch(/^[a-z0-9][a-z0-9-]*$/)
  })

  it('describes every board in both locales', () => {
    for (const rows of [zh.boards.rows, en.boards.rows]) {
      for (const row of rows) {
        expect(row.hw.length).toBeGreaterThan(0)
        expect(row.status.length).toBeGreaterThan(0)
      }
    }
  })
})
