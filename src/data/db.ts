import Dexie, { type EntityTable } from 'dexie'
import type { Book, Issue, Link, Passage, Science, ScienceGroup } from './types'
import { buildSample } from './seed'

// البيانات تُحفظ على الجهاز نفسه وتعمل بلا إنترنت؛ المزامنة بين الأجهزة مرحلة لاحقة
export const db = new Dexie('atwar') as Dexie & {
  sciences: EntityTable<Science, 'id'>
  books: EntityTable<Book, 'id'>
  issues: EntityTable<Issue, 'id'>
  passages: EntityTable<Passage, 'id'>
  links: EntityTable<Link, 'id'>
  groups: EntityTable<ScienceGroup, 'id'>
}

db.version(1).stores({
  sciences: 'id, createdAt',
  books: 'id, scienceId, death',
  issues: 'id, scienceId, section',
  passages: 'id, scienceId, issueId, bookId, updatedAt',
  links: 'id, scienceId, from, to',
})
db.version(2).stores({ groups: 'id, order' })

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
}

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
  }
}

// الاستيراد يضيف ويحدّث ولا يحذف شيئاً موجوداً
export async function importAll(data: unknown): Promise<number> {
  const b = data as Partial<Backup>
  if (!b || b.app !== 'atwar' || !Array.isArray(b.passages)) throw new Error('الملف ليس نسخة احتياطية من أطوار.')
  await db.transaction('rw', [db.sciences, db.books, db.issues, db.passages, db.links, db.groups], async () => {
    await db.groups.bulkPut(b.groups ?? [])
    await db.sciences.bulkPut(b.sciences ?? [])
    await db.books.bulkPut(b.books ?? [])
    await db.issues.bulkPut(b.issues ?? [])
    await db.passages.bulkPut(b.passages ?? [])
    await db.links.bulkPut(b.links ?? [])
  })
  return b.passages.length
}

// يستبدل كل ما على الجهاز بنسخة أخرى، ويُستعمل عند جلب البيانات المنشورة
export async function replaceAll(b: Backup) {
  await db.transaction('rw', [db.sciences, db.books, db.issues, db.passages, db.links, db.groups], async () => {
    await Promise.all([db.sciences.clear(), db.books.clear(), db.issues.clear(), db.passages.clear(), db.links.clear(), db.groups.clear()])
    await db.groups.bulkAdd(b.groups ?? [])
    await db.sciences.bulkAdd(b.sciences ?? [])
    await db.books.bulkAdd(b.books ?? [])
    await db.issues.bulkAdd(b.issues ?? [])
    await db.passages.bulkAdd(b.passages ?? [])
    await db.links.bulkAdd(b.links ?? [])
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
export function datasetHash(b: Pick<Backup, 'sciences' | 'books' | 'issues' | 'passages' | 'links' | 'groups'>) {
  const byId = <T extends { id: string }>(xs: T[] = []) => [...xs].sort((x, y) => (x.id < y.id ? -1 : 1))
  const s = JSON.stringify(canonical({
    groups: byId(b.groups), sciences: byId(b.sciences), books: byId(b.books), issues: byId(b.issues), passages: byId(b.passages), links: byId(b.links),
  }))
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16) + ':' + s.length
}

// هل على هذا الجهاز نصوص كتبها صاحبه قبل تفعيل النشر؟
export async function hasLocalWork() {
  if (!(await Dexie.exists('atwar'))) return false
  return (await db.passages.filter(p => !p.sample).count()) > 0
}
