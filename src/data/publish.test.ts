import { describe, expect, it } from 'vitest'
import { publishable, type Backup } from './db'
import { buildSample } from './seed'

describe('النسخة المنشورة', () => {
  it('تستبعد العلوم المخفية وكل ما فيها', () => {
    const s = buildSample(0)
    const hiddenSci = { id: 'h', name: 'علم مخفي', hidden: true, createdAt: 0 }
    const b: Backup = {
      app: 'atwar', version: 1, exportedAt: '',
      sciences: [s.science, hiddenSci],
      books: [...s.books, { ...s.books[0], id: 'hb', scienceId: 'h' }],
      issues: s.issues, passages: [...s.passages, { ...s.passages[0], id: 'hp', scienceId: 'h' }], links: s.links,
    }
    const p = publishable(b)
    expect(p.sciences.map(x => x.id)).toEqual([s.science.id])
    expect(p.books.some(x => x.scienceId === 'h')).toBe(false)
    expect(p.passages.some(x => x.scienceId === 'h')).toBe(false)
    expect(p.books.length).toBe(s.books.length)
  })
})
