import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, deletePassage } from '../data/db'
import { useStore } from '../data/store'
import type { Passage } from '../data/types'
import { ConfirmButton, PageHead, yr } from '../ui/bits'

export default function PassageEdit() {
  const { id = '' } = useParams()
  const { passages } = useStore()
  const p = passages.find(x => x.id === id)
  if (!p) return <div className="empty">هذا النص غير موجود. <Link to="/issues">المسائل</Link></div>
  return <Editor p={p} key={p.id} />
}

function Editor({ p }: { p: Passage }) {
  const nav = useNavigate()
  const { books, issues } = useStore()
  const [f, setF] = useState({
    lead: p.lead, body: p.body, bookId: p.bookId, issueId: p.issueId,
    volume: p.volume ?? '', page: p.page ?? '', edition: p.edition ?? '', note: p.note ?? '',
  })
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setError('') }
  const back = `/issues/${p.issueId}#${p.id}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.body.trim()) return setError('النص فارغ.')
    const moved = f.bookId !== p.bookId || f.issueId !== p.issueId
    await db.passages.update(p.id, {
      lead: f.lead.trim(), body: f.body.trim(), bookId: f.bookId, issueId: f.issueId,
      volume: f.volume.trim() || undefined, page: f.page.trim() || undefined,
      edition: f.edition.trim() || undefined, note: f.note.trim() || undefined,
      // نقل النص إلى مسألة أو كتاب آخر يُبطل المصدر المحدد سابقاً
      ...(moved ? { source: undefined, confirmed: false } : {}),
      updatedAt: Date.now(),
    })
    nav(`/issues/${f.issueId}#${p.id}`)
  }

  return (
    <>
      <PageHead back={back} title="تعديل النص" />
      <form className="stack" onSubmit={submit} noValidate>
        <label className="field"><span>اللفظ المعرَّف</span><input id="pe-lead" className="input" value={f.lead} onChange={set('lead')} /></label>
        <label className="field"><span>النص</span><textarea id="pe-body" className="textarea" value={f.body} onChange={set('body')} /></label>
        <div className="row">
          <label className="field"><span>الكتاب</span>
            <select id="pe-book" className="select" value={f.bookId} onChange={set('bookId')}>
              {books.map(b => <option key={b.id} value={b.id}>{b.title} ({yr(b)})</option>)}
            </select>
          </label>
          <label className="field"><span>المسألة</span>
            <select id="pe-issue" className="select" value={f.issueId} onChange={set('issueId')}>
              {issues.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
        </div>
        <div className="row">
          <label className="field"><span>الجزء</span><input id="pe-vol" className="input num" value={f.volume} onChange={set('volume')} /></label>
          <label className="field"><span>الصفحة</span><input id="pe-page" className="input num" value={f.page} onChange={set('page')} /></label>
        </div>
        <label className="field"><span>الطبعة أو التحقيق</span><input id="pe-ed" className="input" value={f.edition} onChange={set('edition')} /></label>
        <label className="field"><span>ملاحظة</span><input id="pe-note" className="input" value={f.note} onChange={set('note')} /></label>
        {error && <p className="warn" role="alert">{error}</p>}
        <div className="row">
          <button className="btn primary" type="submit">حفظ التعديل</button>
          <Link className="btn" to={back}>إلغاء</Link>
        </div>
      </form>
      <ConfirmButton label="حذف النص" confirm="حذف هذا النص نهائياً؟" onConfirm={async () => { await deletePassage(p.id); nav(`/issues/${p.issueId}`) }} />
    </>
  )
}
