import { useState, type FormEvent } from 'react'
import { db, newId } from '../data/db'
import { useStore } from '../data/store'
import type { Science, ScienceGroup } from '../data/types'
import * as Icon from './icons'

// ترتيب العلوم ومجموعاتها كما تظهر في الصفحة الرئيسية والقائمة الجانبية
export default function SciencesManager() {
  const { sciences, groups } = useStore()
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [rename, setRename] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function addGroup(e: FormEvent) {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return
    await db.groups.add({ id: newId(), name, order: groups.length ? Math.max(...groups.map(g => g.order)) + 1 : 0, createdAt: Date.now() })
    setDraft('')
  }
  async function moveGroup(i: number, dir: -1 | 1) {
    const list = [...groups]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    await db.transaction('rw', db.groups, () => Promise.all(list.map((g, k) => db.groups.update(g.id, { order: k }))))
  }
  async function deleteGroup(g: ScienceGroup) {
    await db.transaction('rw', [db.groups, db.sciences], async () => {
      await db.sciences.filter(s => s.groupId === g.id).modify({ groupId: undefined })
      await db.groups.delete(g.id)
    })
    setDeleting(null)
  }
  async function moveScience(i: number, dir: -1 | 1) {
    const list = [...sciences]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    await db.transaction('rw', db.sciences, () => Promise.all(list.map((s, k) => db.sciences.update(s.id, { order: k }))))
  }
  const setGroup = (s: Science, groupId: string) => db.sciences.update(s.id, { groupId: groupId || undefined })

  return (
    <div className="stack tight">
      <div className="card list-editor">
        <div><strong>مجموعات العلوم</strong><div className="small muted">مثل علوم الآلة وعلوم الغاية، وتُعرض العلوم تحتها في الصفحة الرئيسية.</div></div>
        {groups.length > 0 && (
          <div className="list">
            {groups.map((g, i) => {
              const n = sciences.filter(s => s.groupId === g.id).length
              return (
                <div className="item le-row" key={g.id}>
                  {editing === g.id ? (
                    <form className="le-edit" onSubmit={async e => { e.preventDefault(); if (rename.trim()) await db.groups.update(g.id, { name: rename.trim() }); setEditing(null) }}>
                      <input id={`grp-${g.id}`} className="input" value={rename} onChange={e => setRename(e.target.value)} autoFocus />
                      <button className="btn sm primary" type="submit">حفظ</button>
                      <button className="btn sm" type="button" onClick={() => setEditing(null)}>إلغاء</button>
                    </form>
                  ) : deleting === g.id ? (
                    <div className="le-edit">
                      <span className="grow small">{n ? `تبقى علومها (${n}) بلا مجموعة. حذف «${g.name}»؟` : `حذف «${g.name}»؟`}</span>
                      <button className="btn sm danger" onClick={() => deleteGroup(g)}>حذف</button>
                      <button className="btn sm" onClick={() => setDeleting(null)}>تراجع</button>
                    </div>
                  ) : (
                    <>
                      <div className="grow"><div className="title">{g.name}</div><div className="meta">{n ? `${n} من العلوم` : 'لا علوم فيها بعد'}</div></div>
                      <span className="le-btns">
                        <button className="icon-btn" disabled={i === 0} onClick={() => moveGroup(i, -1)} aria-label="تقديم"><Icon.Up /></button>
                        <button className="icon-btn" disabled={i === groups.length - 1} onClick={() => moveGroup(i, 1)} aria-label="تأخير"><Icon.Down /></button>
                        <button className="icon-btn" onClick={() => { setEditing(g.id); setRename(g.name) }} aria-label={`تعديل ${g.name}`}><Icon.Edit /></button>
                        <button className="icon-btn" onClick={() => setDeleting(g.id)} aria-label={`حذف ${g.name}`}><Icon.Trash /></button>
                      </span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <form className="row" onSubmit={addGroup}>
          <input id="grp-new" className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="مثل: علوم الآلة" aria-label="مجموعة جديدة" />
          <button className="btn" type="submit" style={{ flex: '0 0 auto' }} disabled={!draft.trim()}><Icon.Plus />إضافة</button>
        </form>
      </div>

      <div className="card list-editor">
        <div><strong>ترتيب العلوم</strong><div className="small muted">رتّبها بالأسهم، واختر مجموعة كل علم.</div></div>
        <div className="list">
          {sciences.map((s, i) => (
            <div className="item le-row" key={s.id}>
              <div className="grow"><div className="title">{s.name}</div></div>
              <select id={`sci-grp-${s.id}`} className="select sci-grp" value={s.groupId ?? ''} onChange={e => setGroup(s, e.target.value)} aria-label={`مجموعة ${s.name}`}>
                <option value="">بلا مجموعة</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <span className="le-btns">
                <button className="icon-btn" disabled={i === 0} onClick={() => moveScience(i, -1)} aria-label="تقديم"><Icon.Up /></button>
                <button className="icon-btn" disabled={i === sciences.length - 1} onClick={() => moveScience(i, 1)} aria-label="تأخير"><Icon.Down /></button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// العلوم مقسومة على مجموعاتها بترتيبها، وما لا مجموعة له في آخرها
export function groupSciences(sciences: Science[], groups: ScienceGroup[]) {
  const out: { group: ScienceGroup | null; items: Science[] }[] = groups.map(g => ({ group: g, items: sciences.filter(s => s.groupId === g.id) }))
  const rest = sciences.filter(s => !s.groupId || !groups.some(g => g.id === s.groupId))
  if (rest.length) out.push({ group: null, items: rest })
  return out.filter(x => x.items.length)
}
