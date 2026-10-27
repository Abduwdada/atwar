import { useState, type FormEvent } from 'react'
import { useStore } from '../data/store'
import { addItem, deleteItem, moveItem, renameItem } from '../data/lists'
import type { ListKey } from '../data/types'
import { count } from './bits'
import * as Icon from './icons'

const META: Record<ListKey, { title: string; hint: string; unit: [string, string, string, string]; placeholder: string }> = {
  schools: { title: 'المذاهب والمدارس', hint: 'تظهر في نموذج الكتاب، وتُلوَّن بها الشجرة.', unit: ['كتاب', 'كتابان', 'كتب', 'كتاباً'], placeholder: 'مثل: حنبلي، أو بصري' },
  kinds: { title: 'أنواع الكتب', hint: 'مثل المتن والشرح والحاشية.', unit: ['كتاب', 'كتابان', 'كتب', 'كتاباً'], placeholder: 'مثل: منظومة' },
  sections: { title: 'الأبواب', hint: 'تُجمع تحتها المسائل، وترتيبها هنا هو ترتيبها في القوائم.', unit: ['مسألة', 'مسألتان', 'مسائل', 'مسألة'], placeholder: 'مثل: الأدلة المتفق عليها' },
}

export default function ListEditor({ k }: { k: ListKey }) {
  const { science, lists, books, issues } = useStore()
  const items = lists[k]
  const m = META[k]
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [rename, setRename] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  if (!science) return null
  const sid = science.id
  const used = (x: string) => k === 'sections' ? issues.filter(i => i.section === x).length
    : books.filter(b => (k === 'schools' ? b.school : b.kind) === x).length

  async function add(e: FormEvent) {
    e.preventDefault()
    await addItem(sid, k, items, draft)
    setDraft('')
  }

  return (
    <div className="card list-editor">
      <div><strong>{m.title}</strong><div className="small muted">{m.hint}</div></div>
      {items.length > 0 && (
        <div className="list">
          {items.map((x, i) => (
            <div className="item le-row" key={x}>
              {editing === x ? (
                <form className="le-edit" onSubmit={async e => { e.preventDefault(); await renameItem(sid, k, items, x, rename); setEditing(null) }}>
                  <input id={`le-${k}-${i}`} className="input" value={rename} onChange={e => setRename(e.target.value)} autoFocus />
                  <button className="btn sm primary" type="submit">حفظ</button>
                  <button className="btn sm" type="button" onClick={() => setEditing(null)}>إلغاء</button>
                </form>
              ) : deleting === x ? (
                <div className="le-edit">
                  <span className="grow small">{used(x) ? `يُزال «${x}» من ${count(used(x), ...m.unit)}. متأكد؟` : `حذف «${x}»؟`}</span>
                  <button className="btn sm danger" onClick={async () => { await deleteItem(sid, k, items, x); setDeleting(null) }}>حذف</button>
                  <button className="btn sm" onClick={() => setDeleting(null)}>تراجع</button>
                </div>
              ) : (
                <>
                  <div className="grow"><div className="title">{x}</div><div className="meta">{used(x) ? `في ${count(used(x), ...m.unit)}` : 'غير مستعمل'}</div></div>
                  <span className="le-btns">
                    <button className="icon-btn" disabled={i === 0} onClick={() => moveItem(sid, k, items, i, -1)} aria-label="تقديم"><Icon.Up /></button>
                    <button className="icon-btn" disabled={i === items.length - 1} onClick={() => moveItem(sid, k, items, i, 1)} aria-label="تأخير"><Icon.Down /></button>
                    <button className="icon-btn" onClick={() => { setEditing(x); setRename(x) }} aria-label={`تعديل ${x}`}><Icon.Edit /></button>
                    <button className="icon-btn" onClick={() => setDeleting(x)} aria-label={`حذف ${x}`}><Icon.Trash /></button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <form className="row" onSubmit={add}>
        <input id={`le-${k}-new`} className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder={m.placeholder} aria-label={`إضافة إلى ${m.title}`} />
        <button className="btn" type="submit" style={{ flex: '0 0 auto' }} disabled={!draft.trim()}><Icon.Plus />إضافة</button>
      </form>
    </div>
  )
}
