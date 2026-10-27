import type { Book, Passage } from '../data/types'
import { tokenize, stripPunct, type Token } from './arabic'
import { align, compare, DEFAULT_TH, type Comparison, type Relation, type Thresholds } from './compare'

export interface Candidate {
  passage: Passage
  book: Book
  cmp: Comparison
}

export interface PassageAnalysis {
  passage: Passage
  book: Book
  tokens: Token[]
  candidates: Candidate[] // النصوص الأقدم في المسألة نفسها، مرتبة بالتشابه
  suggested: Candidate | null // ما يقترحه النظام
  source: Candidate | null // المعتمد: اختيار الباحث إن وُجد، وإلا المقترح
  manual: boolean
  relation: Relation
  close: boolean // مرشحان متقاربان، فقد يرجعان إلى أصل مشترك
  novel: Set<string> // ألفاظ لم ترد في أي نص أقدم من المسألة
  second: { book: Book; words: string[] } | null // أثر مصدر ثانٍ فيما لم يأخذه من الأول
}

export interface BookEdge {
  from: string
  to: string
  weight: number
  items: { issueId: string; sim: number; relation: Relation; manual: boolean }[]
}

export interface ScienceAnalysis {
  passages: Map<string, PassageAnalysis>
  edges: BookEdge[]
  parent: Map<string, BookEdge> // الأصل المستنتج لكل كتاب
  rootOf: (bookId: string) => string // رأس العائلة المعرفية
}

function secondary(tokens: Token[], source: Candidate, candidates: Candidate[]) {
  const matched = new Set(source.cmp.ops.flatMap(o => (o.t === 'eq' ? [o.bi] : [])))
  const rest = tokens.filter((_, i) => !matched.has(i))
  if (rest.length < 3) return null
  let best: { book: Book; words: string[]; L: number } | null = null
  for (const c of candidates) {
    if (c.passage.id === source.passage.id) continue
    const a = align(tokenize(c.passage.body), rest)
    if (a.L >= 3 && (!best || a.L > best.L))
      best = { book: c.book, L: a.L, words: a.ops.flatMap(o => (o.t === 'eq' ? [stripPunct(o.b.raw)] : [])) }
  }
  return best && { book: best.book, words: best.words }
}

export function analyseScience(passages: Passage[], books: Book[], th: Thresholds = DEFAULT_TH): ScienceAnalysis {
  const bookById = new Map(books.map(b => [b.id, b]))
  const valid = passages.filter(p => bookById.has(p.bookId))
  const tokensOf = new Map(valid.map(p => [p.id, tokenize(p.body)]))
  const byIssue = new Map<string, Passage[]>()
  for (const p of valid) byIssue.set(p.issueId, [...(byIssue.get(p.issueId) ?? []), p])

  const result = new Map<string, PassageAnalysis>()
  for (const p of valid) {
    const book = bookById.get(p.bookId)!
    const tokens = tokensOf.get(p.id)!
    const earlier = (byIssue.get(p.issueId) ?? []).filter(s => bookById.get(s.bookId)!.death < book.death)
    const candidates = earlier
      .map(s => ({ passage: s, book: bookById.get(s.bookId)!, cmp: compare(tokensOf.get(s.id)!, tokens, th) }))
      .sort((a, b) => b.cmp.sim - a.cmp.sim)
    const suggested = candidates[0] && candidates[0].cmp.sim >= th.influence ? candidates[0] : null

    let source = suggested
    let manual = false
    if (p.source?.mode === 'none') {
      source = null
      manual = true
    } else if (p.source?.mode === 'manual') {
      const chosen = p.source.passageId
      const c = candidates.find(c => c.passage.id === chosen)
      if (c) {
        source = c
        manual = true
      }
    }

    const seen = new Set(earlier.flatMap(s => tokensOf.get(s.id)!.map(t => t.key)))
    result.set(p.id, {
      passage: p,
      book,
      tokens,
      candidates,
      suggested,
      source,
      manual,
      relation: !earlier.length ? 'first' : source ? source.cmp.relation : 'independent',
      close: !manual && !!suggested && !!candidates[1] && candidates[0].cmp.sim - candidates[1].cmp.sim < 0.05,
      novel: new Set(tokens.filter(t => !seen.has(t.key)).map(t => t.key)),
      second: source && !manual ? secondary(tokens, source, candidates) : null,
    })
  }

  // كل نص يمنح كتابه صلة بكتاب مصدره، وتتراكم الصلات عبر المسائل
  const edgeMap = new Map<string, BookEdge>()
  for (const a of result.values()) {
    if (!a.source) continue
    const key = a.source.book.id + '>' + a.book.id
    const e = edgeMap.get(key) ?? { from: a.source.book.id, to: a.book.id, weight: 0, items: [] }
    // اختيار الباحث يُعتد به ولو قلّ التشابه اللفظي
    e.weight += a.manual ? Math.max(a.source.cmp.sim, th.influence) : a.source.cmp.sim
    e.items.push({ issueId: a.passage.issueId, sim: a.source.cmp.sim, relation: a.source.cmp.relation, manual: a.manual })
    edgeMap.set(key, e)
  }
  const edges = [...edgeMap.values()]
  const parent = new Map<string, BookEdge>()
  for (const e of edges) {
    const cur = parent.get(e.to)
    if (!cur || e.weight > cur.weight) parent.set(e.to, e)
  }
  const rootOf = (id: string) => {
    let r = id
    const guard = new Set<string>()
    while (parent.has(r) && !guard.has(r)) {
      guard.add(r)
      r = parent.get(r)!.from
    }
    return r
  }
  return { passages: result, edges, parent, rootOf }
}
