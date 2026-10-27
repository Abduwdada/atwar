import { db } from './db'
import type { ListKey } from './types'

// القوائم محفوظة مع العلم؛ وتعديل عنصر أو حذفه يسري على كل ما يحمله من كتب ومسائل
const FIELD = { schools: 'school', kinds: 'kind', sections: 'section' } as const

async function current(sid: string) {
  return (await db.sciences.get(sid))?.lists ?? {}
}

export async function saveList(sid: string, key: ListKey, items: string[]) {
  const lists = await current(sid)
  await db.sciences.update(sid, { lists: { ...lists, [key]: items } })
}

export async function addItem(sid: string, key: ListKey, items: string[], item: string) {
  const v = item.trim()
  if (!v || items.includes(v)) return v
  await saveList(sid, key, [...items, v])
  return v
}

export async function renameItem(sid: string, key: ListKey, items: string[], from: string, to: string) {
  const v = to.trim()
  if (!v || v === from) return
  await db.transaction('rw', [db.sciences, db.books, db.issues], async () => {
    await saveList(sid, key, [...new Set(items.map(x => (x === from ? v : x)))])
    if (key === 'sections') await db.issues.where({ scienceId: sid }).filter(i => i.section === from).modify({ section: v })
    else await db.books.where({ scienceId: sid }).filter(b => b[FIELD[key]] === from).modify({ [FIELD[key]]: v })
  })
}

export async function deleteItem(sid: string, key: ListKey, items: string[], item: string) {
  await db.transaction('rw', [db.sciences, db.books, db.issues], async () => {
    await saveList(sid, key, items.filter(x => x !== item))
    if (key === 'sections') await db.issues.where({ scienceId: sid }).filter(i => i.section === item).modify({ section: undefined })
    else await db.books.where({ scienceId: sid }).filter(b => b[FIELD[key]] === item).modify({ [FIELD[key]]: undefined })
  })
}

export async function moveItem(sid: string, key: ListKey, items: string[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= items.length) return
  const next = [...items]
  ;[next[i], next[j]] = [next[j], next[i]]
  await saveList(sid, key, next)
}
