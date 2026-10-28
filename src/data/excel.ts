import { db, ensureAuthors, newId } from './db'
import type { Author, Book, Issue, Passage, Science } from './types'
import { splitLead, tokenize } from '../engine/arabic'

// ملف إكسل لكل علم: يُنزَّل ببياناته، فيُضاف إليه ويُعدَّل، ثم يُستورد فيُضاف الجديد ويُحدَّث الموجود ولا يُحذف شيء
export const SHEET = { guide: 'طريقة الاستعمال', books: 'الكتب', issues: 'المسائل', passages: 'النصوص', matrix: 'المصفوفة', authors: 'المؤلفون' } as const
const COL = {
  id: 'المعرف', title: 'العنوان', author: 'المؤلف', death: 'سنة الوفاة', deathNote: 'ملاحظة على السنة', school: 'المذهب أو المدرسة',
  kind: 'نوع الكتاب', method: 'طريقة التأليف', issue: 'المسألة', section: 'الباب', book: 'الكتاب', lead: 'اللفظ المعرف', body: 'النص',
  volume: 'الجزء', page: 'الصفحة', edition: 'الطبعة أو التحقيق', note: 'ملاحظة', name: 'الاسم', bio: 'تعريف',
}

export interface Data { science: Science; books: Book[]; issues: Issue[]; passages: Passage[]; authors: Author[] }

const DIG = '٠١٢٣٤٥٦٧٨٩'
const num = (v: unknown) => {
  const s = String(v ?? '').replace(/[٠-٩]/g, d => String(DIG.indexOf(d))).replace(/[^\d]/g, '')
  return s ? Number(s) : NaN
}
const str = (v: unknown) => String(v ?? '').trim()
const titleKey = (s: string) => s.replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim()
const bodyKey = (s: string) => tokenize(s).map(t => t.key).join(' ')

export async function exportScience(d: Data): Promise<Blob> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const bookTitle = new Map(d.books.map(b => [b.id, b.title]))
  const issueName = new Map(d.issues.map(i => [i.id, i.name]))
  const sheet = (rows: unknown[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = widths.map(w => ({ wch: w }))
    return ws
  }
  XLSX.utils.book_append_sheet(wb, sheet([
    [`ملف «${d.science.name}» من منصة أطوار`],
    [''],
    ['• أضف صفوفاً جديدة في أي ورقة، أو عدّل الصفوف الموجودة، ثم استورد الملف من «إعدادات العلم».'],
    ['• اترك عمود «المعرف» فارغاً في الصفوف الجديدة، ولا تغيّره في الصفوف الموجودة؛ به يُعرف الصف فيُحدَّث بدل أن يُضاف.'],
    ['• الخلية الفارغة في صف موجود لا تمسح قيمته. والاستيراد لا يحذف شيئاً من المنصة.'],
    ['• في ورقة «النصوص» اكتب اسم المسألة واسم الكتاب كما هما في ورقتيهما. المسألة الجديدة تُنشأ تلقائياً، والكتاب الجديد يُضاف في ورقة «الكتب» أولاً مع سنة الوفاة.'],
    ['• ورقة «المصفوفة» على هيئة الجدول المعتاد: المسائل صفوفاً والكتب أعمدة، وفي الصفوف الثلاثة الأولى عنوان الكتاب ومؤلفه وسنة وفاته. تُضاف منها النصوص الجديدة فقط.'],
    ['• الأرقام تُقبل بالعربية أو بالإنجليزية.'],
  ], [120]), SHEET.guide)
  XLSX.utils.book_append_sheet(wb, sheet([
    [COL.id, COL.title, COL.author, COL.death, COL.deathNote, COL.school, COL.kind, COL.method],
    ...d.books.map(b => [b.id, b.title, b.author, b.death, b.deathNote ?? '', b.school ?? '', b.kind ?? '', b.method ?? '']),
  ], [38, 28, 26, 10, 18, 18, 14, 18]), SHEET.books)
  if (d.science.mode !== 'books') {
    XLSX.utils.book_append_sheet(wb, sheet([
      [COL.id, COL.issue, COL.section],
      ...d.issues.map(i => [i.id, i.name, i.section ?? '']),
    ], [38, 34, 26]), SHEET.issues)
    XLSX.utils.book_append_sheet(wb, sheet([
      [COL.id, COL.issue, COL.book, COL.lead, COL.body, COL.volume, COL.page, COL.edition, COL.note],
      ...d.passages.map(p => [p.id, issueName.get(p.issueId) ?? '', bookTitle.get(p.bookId) ?? '', p.lead, p.body, p.volume ?? '', p.page ?? '', p.edition ?? '', p.note ?? '']),
    ], [38, 26, 24, 16, 70, 8, 8, 26, 20]), SHEET.passages)
    const sorted = [...d.books].sort((a, b) => a.death - b.death)
    const cell = (iss: Issue, b: Book) => {
      const p = d.passages.find(x => x.issueId === iss.id && x.bookId === b.id)
      return p ? [p.lead, p.body].filter(Boolean).join(' ') : ''
    }
    XLSX.utils.book_append_sheet(wb, sheet([
      [COL.book, ...sorted.map(b => b.title)],
      [COL.author, ...sorted.map(b => b.author)],
      [COL.death, ...sorted.map(b => b.death)],
      ...d.issues.map(i => [i.name, ...sorted.map(b => cell(i, b))]),
    ], [28, ...sorted.map(() => 40)]), SHEET.matrix)
  }
  const used = new Set(d.books.map(b => b.authorId))
  XLSX.utils.book_append_sheet(wb, sheet([
    [COL.id, COL.name, COL.death, COL.bio],
    ...d.authors.filter(a => used.has(a.id)).map(a => [a.id, a.name, a.death ?? '', a.bio ?? '']),
  ], [38, 28, 10, 60]), SHEET.authors)
  wb.Workbook = { Views: [{ RTL: true }] }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export interface Plan {
  books: { add: Book[]; update: Book[] }
  issues: { add: Issue[]; update: Issue[] }
  passages: { add: Passage[]; update: Passage[] }
  authors: { add: Author[]; update: Author[] }
  skipped: number // صفوف مطابقة لما في المنصة
  errors: string[]
}

// يقرأ الملف ويبني خطة بما سيُضاف ويُحدَّث، دون أن يغيّر شيئاً
export async function planImport(file: File, d: Data): Promise<Plan> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer())
  const plan: Plan = { books: { add: [], update: [] }, issues: { add: [], update: [] }, passages: { add: [], update: [] }, authors: { add: [], update: [] }, skipped: 0, errors: [] }
  const now = Date.now()
  const sid = d.science.id
  const rowsOf = (name: string) => {
    const ws = wb.Sheets[name]
    if (!ws) return null
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true })
    const head = (rows[0] ?? []).map(h => str(h))
    const idx = (c: string) => head.indexOf(c)
    return { rows: rows.slice(1), get: (r: unknown[], c: string) => (idx(c) >= 0 ? r[idx(c)] : '') }
  }

  // الكتب
  const books = new Map(d.books.map(b => [b.id, { ...b }]))
  const byTitle = new Map<string, Book>()
  d.books.forEach(b => byTitle.set(titleKey(b.title), b))
  const bs = rowsOf(SHEET.books)
  bs?.rows.forEach((r, i) => {
    const title = str(bs.get(r, COL.title))
    if (!title) return
    const id = str(bs.get(r, COL.id))
    const death = num(bs.get(r, COL.death))
    const patch: Partial<Book> = {}
    const take = <K extends keyof Book>(k: K, v: Book[K] | '') => { if (v !== '' && v !== undefined && !(typeof v === 'number' && isNaN(v))) patch[k] = v as Book[K] }
    take('title', title); take('author', str(bs.get(r, COL.author))); take('death', death)
    take('deathNote', str(bs.get(r, COL.deathNote))); take('school', str(bs.get(r, COL.school)))
    take('kind', str(bs.get(r, COL.kind))); take('method', str(bs.get(r, COL.method)))
    const existing = (id && books.get(id)) || byTitle.get(titleKey(title))
    if (existing) {
      const next = { ...existing, ...patch }
      if (patch.author && patch.author !== existing.author) next.authorId = undefined
      if (JSON.stringify(next) !== JSON.stringify(existing)) { plan.books.update.push(next); books.set(next.id, next) } else plan.skipped++
    } else {
      if (!Number.isInteger(death) || death < 1 || death > 1500) return plan.errors.push(`الكتب، الصف ${i + 2}: «${title}» بلا سنة وفاة صحيحة.`)
      if (!patch.author) return plan.errors.push(`الكتب، الصف ${i + 2}: «${title}» بلا مؤلف.`)
      const b: Book = { id: newId(), scienceId: sid, title, author: patch.author, death, deathNote: patch.deathNote, school: patch.school, kind: patch.kind, method: patch.method, createdAt: now }
      plan.books.add.push(b); books.set(b.id, b); byTitle.set(titleKey(title), b)
    }
  })

  // المسائل
  const issues = new Map(d.issues.map(x => [x.id, { ...x }]))
  const byName = new Map<string, Issue>()
  d.issues.forEach(x => byName.set(titleKey(x.name), x))
  const ensureIssue = (name: string, section?: string) => {
    const k = titleKey(name)
    let x = byName.get(k)
    if (!x) {
      x = { id: newId(), scienceId: sid, name, section: section || undefined, createdAt: now + plan.issues.add.length }
      plan.issues.add.push(x); issues.set(x.id, x); byName.set(k, x)
    }
    return x
  }
  const is = rowsOf(SHEET.issues)
  is?.rows.forEach(r => {
    const name = str(is.get(r, COL.issue))
    if (!name) return
    const id = str(is.get(r, COL.id)), section = str(is.get(r, COL.section))
    const existing = (id && issues.get(id)) || byName.get(titleKey(name))
    if (existing) {
      const next = { ...existing, name, ...(section ? { section } : {}) }
      if (JSON.stringify(next) !== JSON.stringify(existing)) { plan.issues.update.push(next); issues.set(next.id, next) } else plan.skipped++
    } else ensureIssue(name, section)
  })

  // النصوص
  const passages = new Map(d.passages.map(p => [p.id, { ...p }]))
  // النص الموجود يُعرف بمتنه وحده أو مع لفظه المعرَّف، كما يُكتب في خلية المصفوفة
  const seen = new Set(d.passages.flatMap(p => [`${p.issueId}|${p.bookId}|${bodyKey(p.body)}`, `${p.issueId}|${p.bookId}|${bodyKey(p.lead + ' ' + p.body)}`]))
  const addPassage = (issue: Issue, book: Book, text: string, extra: Partial<Passage> = {}, lead?: string) => {
    const split = lead ? { lead, body: text } : splitLead(text)
    const keys = [`${issue.id}|${book.id}|${bodyKey(split.body)}`, `${issue.id}|${book.id}|${bodyKey(text)}`]
    if (!split.body || keys.some(k => seen.has(k))) return void plan.skipped++
    keys.forEach(k => seen.add(k))
    plan.passages.add.push({ id: newId(), scienceId: sid, issueId: issue.id, bookId: book.id, lead: split.lead, body: split.body, createdAt: now, updatedAt: now, ...extra })
  }
  const ps = rowsOf(SHEET.passages)
  ps?.rows.forEach((r, i) => {
    const body = str(ps.get(r, COL.body))
    const id = str(ps.get(r, COL.id))
    if (!body && !id) return
    const issueName = str(ps.get(r, COL.issue)), bookTitle = str(ps.get(r, COL.book))
    const extra: Partial<Passage> = {}
    const put = (k: 'volume' | 'page' | 'edition' | 'note', c: string) => { const v = str(ps.get(r, c)); if (v) extra[k] = v }
    put('volume', COL.volume); put('page', COL.page); put('edition', COL.edition); put('note', COL.note)
    const lead = str(ps.get(r, COL.lead))
    const existing = id ? passages.get(id) : undefined
    if (existing) {
      const next: Passage = { ...existing, ...extra, ...(body ? { body } : {}), ...(lead ? { lead } : {}) }
      if (issueName) next.issueId = (byName.get(titleKey(issueName)) ?? ensureIssue(issueName)).id
      if (bookTitle) { const b = byTitle.get(titleKey(bookTitle)); if (b) next.bookId = b.id; else return plan.errors.push(`النصوص، الصف ${i + 2}: الكتاب «${bookTitle}» غير موجود.`) }
      const changed = JSON.stringify({ ...next, updatedAt: 0 }) !== JSON.stringify({ ...existing, updatedAt: 0 })
      if (changed) plan.passages.update.push({ ...next, updatedAt: now }); else plan.skipped++
      return
    }
    if (!issueName) return plan.errors.push(`النصوص، الصف ${i + 2}: بلا مسألة.`)
    const book = byTitle.get(titleKey(bookTitle))
    if (!book) return plan.errors.push(`النصوص، الصف ${i + 2}: الكتاب «${bookTitle || 'فارغ'}» غير موجود. أضفه في ورقة «الكتب» أولاً.`)
    addPassage(ensureIssue(issueName), book, body, extra, lead || undefined)
  })

  // المصفوفة: صفوف الكتاب والمؤلف والوفاة، ثم المسائل
  const ws = wb.Sheets[SHEET.matrix]
  if (ws) {
    const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true })
    const titles = (m[0] ?? []).slice(1).map(str), authors = (m[1] ?? []).slice(1).map(str), deaths = (m[2] ?? []).slice(1).map(num)
    const cols: (Book | undefined)[] = titles.map((t, c) => {
      if (!t) return undefined
      const found = byTitle.get(titleKey(t))
      if (found) return found
      if (!Number.isInteger(deaths[c]) || !authors[c]) { plan.errors.push(`المصفوفة، العمود ${c + 2}: «${t}» كتاب جديد يحتاج مؤلفاً وسنة وفاة في الصفين الثاني والثالث.`); return undefined }
      const b: Book = { id: newId(), scienceId: sid, title: t, author: authors[c], death: deaths[c], createdAt: now }
      plan.books.add.push(b); byTitle.set(titleKey(t), b)
      return b
    })
    m.slice(3).forEach(r => {
      const name = str(r[0])
      if (!name) return
      const issue = ensureIssue(name)
      cols.forEach((b, c) => { const text = str(r[c + 1]); if (b && text) addPassage(issue, b, text) })
    })
  }

  // المؤلفون
  const as = rowsOf(SHEET.authors)
  const authors = new Map(d.authors.map(a => [a.id, a]))
  as?.rows.forEach(r => {
    const id = str(as.get(r, COL.id)), name = str(as.get(r, COL.name))
    const death = num(as.get(r, COL.death)), bio = str(as.get(r, COL.bio))
    const existing = id ? authors.get(id) : undefined
    if (existing) {
      const next: Author = { ...existing, ...(name ? { name } : {}), ...(Number.isInteger(death) ? { death } : {}), ...(bio ? { bio } : {}) }
      if (JSON.stringify(next) !== JSON.stringify(existing)) plan.authors.update.push(next); else plan.skipped++
    } else if (name && !id) {
      plan.authors.add.push({ id: newId(), name, death: Number.isInteger(death) ? death : undefined, bio: bio || undefined, createdAt: now })
    }
  })
  return plan
}

export async function applyImport(plan: Plan) {
  await db.transaction('rw', [db.books, db.issues, db.passages, db.authors], async () => {
    await db.authors.bulkPut([...plan.authors.add, ...plan.authors.update])
    await db.books.bulkPut([...plan.books.add, ...plan.books.update])
    await db.issues.bulkPut([...plan.issues.add, ...plan.issues.update])
    await db.passages.bulkPut([...plan.passages.add, ...plan.passages.update])
    // اسم المؤلف المعدّل في السجل يسري على كتبه
    for (const a of plan.authors.update) await db.books.filter(b => b.authorId === a.id).modify({ author: a.name })
  })
  await ensureAuthors()
}

export const planSize = (p: Plan) =>
  p.books.add.length + p.books.update.length + p.issues.add.length + p.issues.update.length +
  p.passages.add.length + p.passages.update.length + p.authors.add.length + p.authors.update.length
