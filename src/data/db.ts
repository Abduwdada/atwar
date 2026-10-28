import Dexie, { type EntityTable } from 'dexie'
import type { Author, Book, Issue, Link, Passage, Science, ScienceGroup, XLink } from './types'
import { buildSample } from './seed'

// البيانات تُحفظ على الجهاز نفسه وتعمل بلا إنترنت؛ المزامنة بين الأجهزة مرحلة لاحقة
export const db = new Dexie('atwar') as Dexie & {
  sciences: EntityTable<Science, 'id'>
  books: EntityTable<Book, 'id'>
  issues: EntityTable<Issue, 'id'>
  passages: EntityTable<Passage, 'id'>
  links: EntityTable<Link, 'id'>
  groups: EntityTable<ScienceGroup, 'id'>
  authors: EntityTable<Author, 'id'>
  xlinks: EntityTable<XLink, 'id'>
}

db.version(1).stores({
  sciences: 'id, createdAt',
  books: 'id, scienceId, death',
  issues: 'id, scienceId, section',
  passages: 'id, scienceId, issueId, bookId, updatedAt',
  links: 'id, scienceId, from, to',
})
db.version(2).stores({ groups: 'id, order' })
db.version(3).stores({ authors: 'id, name', xlinks: 'id, from, to' })

db.on('populate', tx => {
  const s = buildSample()
  tx.table('sciences').add(s.science)
  tx.table('books').bulkAdd(s.books)
  tx.table('issues').bulkAdd(s.issues)
  tx.table('passages').bulkAdd(s.passages)
  tx.table('links').bulkAdd(s.links)
})

export const newId = () => crypto.randomUUID()

export async function removeSample(scienceId: string) {
  await db.transaction('rw', [db.books, db.issues, db.passages, db.links], async () => {
    // نصوص الباحث المرتبطة بكتب أو مسائل العينة تبقى، وتبقى معها تلك الكتب والمسائل
    const own = await db.passages.where({ scienceId }).filter(p => !p.sample).toArray()
    const keepBooks = new Set(own.map(p => p.bookId))
    const keepIssues = new Set(own.map(p => p.issueId))
    await db.passages.where({ scienceId }).filter(p => !!p.sample).delete()
    await db.links.where({ scienceId }).filter(l => !!l.sample).delete()
    await db.books.where({ scienceId }).filter(b => !!b.sample && !keepBooks.has(b.id)).delete()
    await db.issues.where({ scienceId }).filter(i => !!i.sample && !keepIssues.has(i.id)).delete()
  })
}

export async function deletePassage(id: string) {
  await db.transaction('rw', db.passages, async () => {
    await db.passages.delete(id)
    // من اختار هذا النص مصدراً يعود إلى المصدر المقترح
    const dependents = await db.passages
      .filter(p => p.source?.mode === 'manual' && p.source.passageId === id)
      .toArray()
    for (const p of dependents) await db.passages.update(p.id, { source: undefined, confirmed: false })
  })
}

export interface Backup {
  app: 'atwar'
  version: 1
  exportedAt: string
  sciences: Science[]
  groups?: ScienceGroup[]
  books: Book[]
  issues: Issue[]
  passages: Passage[]
  links: Link[]
  authors?: Author[]
  xlinks?: XLink[]
}

const KEYS = ['groups', 'sciences', 'books', 'issues', 'passages', 'links', 'authors', 'xlinks'] as const
const allTables = () => KEYS.map(k => db[k])

export async function exportAll(): Promise<Backup> {
  return {
    app: 'atwar',
    version: 1,
    exportedAt: new Date().toISOString(),
    sciences: await db.sciences.toArray(),
    groups: await db.groups.toArray(),
    books: await db.books.toArray(),
    issues: await db.issues.toArray(),
    passages: await db.passages.toArray(),
    links: await db.links.toArray(),
    authors: await db.authors.toArray(),
    xlinks: await db.xlinks.toArray(),
  }
}

// الاستيراد يضيف ويحدّث ولا يحذف شيئاً موجوداً
export async function importAll(data: unknown): Promise<number> {
  const b = data as Partial<Backup>
  if (!b || b.app !== 'atwar' || !Array.isArray(b.passages)) throw new Error('الملف ليس نسخة احتياطية من أطوار.')
  await db.transaction('rw', allTables(), async () => {
    for (const k of KEYS) await (db[k] as Dexie.Table).bulkPut((b[k] as unknown[]) ?? [])
  })
  await ensureAuthors()
  return b.passages.length
}

// ما يُنشر للزوار: كل شيء عدا العلوم المخفية وما فيها، وما يتصل بها من صلات ومؤلفين
export function publishable(b: Backup): Backup {
  const hidden = new Set(b.sciences.filter(s => s.hidden).map(s => s.id))
  const keep = <T extends { scienceId: string }>(xs: T[]) => xs.filter(x => !hidden.has(x.scienceId))
  const books = keep(b.books)
  const shown = new Set(books.map(x => x.id))
  const authorsUsed = new Set(books.map(x => x.authorId).filter(Boolean))
  return {
    ...b, sciences: b.sciences.filter(s => !hidden.has(s.id)), books, issues: keep(b.issues), passages: keep(b.passages), links: keep(b.links),
    authors: (b.authors ?? []).filter(a => authorsUsed.has(a.id)),
    xlinks: (b.xlinks ?? []).filter(x => shown.has(x.from) && shown.has(x.to)),
  }
}

// يستبدل ما على الجهاز بالنسخة المنشورة، ويُبقي العلوم المخفية لأنها لا تُنشر أصلاً
export async function replaceAll(b: Backup) {
  const local = await exportAll()
  const hidden = new Set(local.sciences.filter(s => s.hidden).map(s => s.id))
  const mine = <T extends { scienceId: string }>(xs: T[]) => xs.filter(x => hidden.has(x.scienceId))
  const myBooks = new Set(mine(local.books).map(x => x.id))
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map(t => t.clear()))
    for (const k of KEYS) await (db[k] as Dexie.Table).bulkAdd((b[k] as unknown[]) ?? [])
    await db.sciences.bulkPut(local.sciences.filter(s => hidden.has(s.id)))
    await db.books.bulkPut(mine(local.books))
    await db.issues.bulkPut(mine(local.issues))
    await db.passages.bulkPut(mine(local.passages))
    await db.links.bulkPut(mine(local.links))
    await db.xlinks.bulkPut((local.xlinks ?? []).filter(x => myBooks.has(x.from) || myBooks.has(x.to)))
    const keepAuthors = new Set(mine(local.books).map(x => x.authorId))
    await db.authors.bulkPut((local.authors ?? []).filter(a => keepAuthors.has(a.id)))
  })
  await ensureAuthors()
}

// اسم المؤلف بصورة موحدة: بلا حركات ولا فروق في الهمزات والمسافات
export const authorKey = (name: string) => name.replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim()

// يربط كل كتاب بلا مؤلف في السجل بمؤلف يحمل الاسم نفسه وسنة الوفاة نفسها، أو ينشئه
export async function ensureAuthors() {
  await db.transaction('rw', db.books, db.authors, async () => {
    const loose = await db.books.filter(b => !b.authorId && !!b.author?.trim()).toArray()
    if (!loose.length) return
    const authors = await db.authors.toArray()
    const index = new Map(authors.map(a => [authorKey(a.name) + '|' + (a.death ?? ''), a.id]))
    for (const b of loose) {
      const k = authorKey(b.author) + '|' + b.death
      let id = index.get(k)
      if (!id) {
        id = newId()
        await db.authors.add({ id, name: b.author.trim(), death: b.death, createdAt: Date.now() })
        index.set(k, id)
      }
      await db.books.update(b.id, { authorId: id })
    }
  })
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined)
      .map(k => [k, canonical((v as Record<string, unknown>)[k])]))
  return v
}

// بصمة المحتوى دون تاريخ التصدير، لمعرفة هل تغيّر شيء منذ آخر نشر
export function datasetHash(b: Partial<Backup>) {
  const byId = <T extends { id: string }>(xs: T[] = []) => [...xs].sort((x, y) => (x.id < y.id ? -1 : 1))
  const s = JSON.stringify(canonical(Object.fromEntries(KEYS.map(k => [k, byId((b[k] as { id: string }[]) ?? [])]))))
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16) + ':' + s.length
}

// هل على هذا الجهاز نصوص كتبها صاحبه قبل تفعيل النشر؟
export async function hasLocalWork() {
  if (!(await Dexie.exists('atwar'))) return false
  return (await db.passages.filter(p => !p.sample).count()) > 0
}
