import { useState, type FormEvent } from 'react'
import { db, newId } from '../data/db'
import { useStore } from '../data/store'
import type { Book, Issue, ListKey } from '../data/types'
import { addItem } from '../data/lists'
import { ar } from './bits'

// قائمة منسدلة من قوائم العلم، وفي آخرها «إضافة جديد» تضيف إلى القائمة نفسها
export function ListSelect({ id, label, k, value, onChange }: { id: string; label: string; k: ListKey; value: string; onChange: (v: string) => void }) {
  const { science, lists } = useStore()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const items = lists[k]

  async function add() {
    if (!draft.trim()) return
    const v = await addItem(science!.id, k, items, draft)
    onChange(v)
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="field">
      <label htmlFor={id}><span>{label}</span></label>
      {adding ? (
        <div className="row add-inline">
          <input id={id} className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="الاسم الجديد" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } if (e.key === 'Escape') setAdding(false) }} />
          <button className="btn" type="button" onClick={add} disabled={!draft.trim()}>إضافة</button>
          <button className="btn ghost" type="button" onClick={() => setAdding(false)}>إلغاء</button>
        </div>
      ) : (
        <select id={id} className="select" value={value} onChange={e => (e.target.value === '__add' ? setAdding(true) : onChange(e.target.value))}>
          <option value="">غير محدد</option>
          {items.map(x => <option key={x} value={x}>{x}</option>)}
          <option value="__add">＋ إضافة جديد…</option>
        </select>
      )}
    </div>
  )
}

// يقبل الأرقام العربية والهندية: «٦٠٦» و«606»
export const toNum = (s: string) => Number(s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim())

export function BookForm({ book, onSaved, onCancel }: { book?: Book; onSaved: (b: Book) => void; onCancel?: () => void }) {
  const { science } = useStore()
  const [title, setTitle] = useState(book?.title ?? '')
  const [author, setAuthor] = useState(book?.author ?? '')
  const [death, setDeath] = useState(book ? ar(book.death) : '')
  const [deathNote, setDeathNote] = useState(book?.deathNote ?? '')
  const [school, setSchool] = useState(book?.school ?? '')
  const [kind, setKind] = useState(book?.kind ?? '')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const d = toNum(death)
    if (!title.trim()) return setError('اكتب عنوان الكتاب.')
    if (!author.trim()) return setError('اكتب اسم المؤلف.')
    if (!Number.isInteger(d) || d < 1 || d > 1500) return setError('اكتب سنة الوفاة بالهجري رقماً، مثل ٦٠٦.')
    const saved: Book = {
      ...(book ?? { id: newId(), scienceId: science!.id, createdAt: Date.now() }),
      title: title.trim(), author: author.trim(), death: d,
      deathNote: deathNote.trim() || undefined, school: school.trim() || undefined, kind: kind || undefined,
    }
    await db.books.put(saved)
    onSaved(saved)
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <label className="field"><span>عنوان الكتاب</span>
        <input id="bf-title" className="input" value={title} onChange={e => { setTitle(e.target.value); setError('') }} placeholder="عنوان الكتاب كما اشتهر" autoFocus />
      </label>
      <label className="field"><span>المؤلف</span>
        <input id="bf-author" className="input" value={author} onChange={e => { setAuthor(e.target.value); setError('') }} placeholder="اسم المؤلف" />
      </label>
      <div className="row">
        <label className="field"><span>سنة الوفاة (هـ)</span>
          <input id="bf-death" className="input num" inputMode="numeric" value={death} onChange={e => { setDeath(e.target.value); setError('') }} placeholder="مثل ٦٠٦" />
        </label>
        <label className="field"><span>ملاحظة على السنة</span>
          <input id="bf-dnote" className="input" value={deathNote} onChange={e => setDeathNote(e.target.value)} placeholder="مثل: وقيل ٦٠٤هـ" />
        </label>
      </div>
      <div className="row">
        <ListSelect id="bf-school" label="المذهب أو المدرسة" k="schools" value={school} onChange={setSchool} />
        <ListSelect id="bf-kind" label="نوع الكتاب" k="kinds" value={kind} onChange={setKind} />
      </div>
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn primary" type="submit">{book ? 'حفظ التعديل' : 'إضافة الكتاب'}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>إلغاء</button>}
      </div>
    </form>
  )
}

export function IssueForm({ issue, onSaved, onCancel, initialName = '' }: { issue?: Issue; onSaved: (i: Issue) => void; onCancel?: () => void; initialName?: string }) {
  const { science } = useStore()
  const [name, setName] = useState(issue?.name ?? initialName)
  const [section, setSection] = useState(issue?.section ?? '')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('اكتب اسم المسألة أو المصطلح.')
    const saved: Issue = {
      ...(issue ?? { id: newId(), scienceId: science!.id, createdAt: Date.now() }),
      name: name.trim(), section: section.trim() || undefined,
    }
    await db.issues.put(saved)
    onSaved(saved)
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <label className="field"><span>المسألة أو المصطلح</span>
        <input id="if-name" className="input" value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="مثل: تعريف المصطلح، أو مسألة بعينها" autoFocus />
      </label>
      <ListSelect id="if-section" label="الباب أو الفصل" k="sections" value={section} onChange={setSection} />
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn primary" type="submit">{issue ? 'حفظ التعديل' : 'إضافة المسألة'}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>إلغاء</button>}
      </div>
    </form>
  )
}
