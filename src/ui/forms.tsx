import { useState, type FormEvent } from 'react'
import { db, newId } from '../data/db'
import { useStore } from '../data/store'
import { BOOK_KINDS, type Book, type Issue } from '../data/types'
import { ar } from './bits'

// يقبل الأرقام العربية والهندية: «٦٠٦» و«606»
export const toNum = (s: string) => Number(s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim())

export function BookForm({ book, onSaved, onCancel }: { book?: Book; onSaved: (b: Book) => void; onCancel?: () => void }) {
  const { science, books } = useStore()
  const [title, setTitle] = useState(book?.title ?? '')
  const [author, setAuthor] = useState(book?.author ?? '')
  const [death, setDeath] = useState(book ? ar(book.death) : '')
  const [deathNote, setDeathNote] = useState(book?.deathNote ?? '')
  const [school, setSchool] = useState(book?.school ?? '')
  const [kind, setKind] = useState(book?.kind ?? '')
  const [error, setError] = useState('')
  const schools = [...new Set(books.map(b => b.school).filter(Boolean))] as string[]

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
        <input id="bf-title" className="input" value={title} onChange={e => { setTitle(e.target.value); setError('') }} placeholder="المحصول في علم الأصول" autoFocus />
      </label>
      <label className="field"><span>المؤلف</span>
        <input id="bf-author" className="input" value={author} onChange={e => { setAuthor(e.target.value); setError('') }} placeholder="فخر الدين الرازي" />
      </label>
      <div className="row">
        <label className="field"><span>سنة الوفاة (هـ)</span>
          <input id="bf-death" className="input num" inputMode="numeric" value={death} onChange={e => { setDeath(e.target.value); setError('') }} placeholder="٦٠٦" />
        </label>
        <label className="field"><span>ملاحظة على السنة</span>
          <input id="bf-dnote" className="input" value={deathNote} onChange={e => setDeathNote(e.target.value)} placeholder="وقيل ٦٠٤هـ" />
        </label>
      </div>
      <div className="row">
        <label className="field"><span>المذهب</span>
          <input id="bf-school" className="input" list="bf-schools" value={school} onChange={e => setSchool(e.target.value)} placeholder="شافعي" />
          <datalist id="bf-schools">{schools.map(s => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="field"><span>نوعه</span>
          <select id="bf-kind" className="select" value={kind} onChange={e => setKind(e.target.value)}>
            <option value="">غير محدد</option>
            {BOOK_KINDS.map(k => <option key={k}>{k}</option>)}
          </select>
        </label>
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
  const { science, issues } = useStore()
  const [name, setName] = useState(issue?.name ?? initialName)
  const [section, setSection] = useState(issue?.section ?? '')
  const [error, setError] = useState('')
  const sections = [...new Set(issues.map(i => i.section).filter(Boolean))] as string[]

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
        <input id="if-name" className="input" value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="تعريف المندوب" autoFocus />
      </label>
      <label className="field"><span>الباب</span>
        <input id="if-section" className="input" list="if-sections" value={section} onChange={e => setSection(e.target.value)} placeholder="الحكم التكليفي" />
        <datalist id="if-sections">{sections.map(s => <option key={s} value={s} />)}</datalist>
      </label>
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn primary" type="submit">{issue ? 'حفظ التعديل' : 'إضافة المسألة'}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>إلغاء</button>}
      </div>
    </form>
  )
}
