import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, newId } from '../data/db'
import { useStore } from '../data/store'
import { Badge, ConfirmButton, PageHead, ar, count, pct, yr } from '../ui/bits'
import { BookForm } from '../ui/forms'
import * as Icon from '../ui/icons'

export function BookList() {
  const { books, passages } = useStore()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const nav = useNavigate()
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    passages.forEach(p => m.set(p.bookId, (m.get(p.bookId) ?? 0) + 1))
    return m
  }, [passages])
  const t = q.trim()
  const shown = books.filter(b => !t || b.title.includes(t) || b.author.includes(t))

  return (
    <>
      <PageHead title="الكتب" sub={`${count(books.length, 'كتاب', 'كتابان', 'كتب', 'كتاباً')}، مرتبة بسنة الوفاة`}
        action={<button className="btn sm" onClick={() => setAdding(a => !a)}><Icon.Plus />كتاب</button>} />
      {adding && <BookForm onSaved={b => nav(`/books/${b.id}`)} onCancel={() => setAdding(false)} />}
      <div className="search"><Icon.Search /><input id="books-q" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالعنوان أو المؤلف" /></div>
      {shown.length > 0 && (
        <div className="list">
          {shown.map(b => (
            <Link key={b.id} className="item" to={`/books/${b.id}`}>
              <span className="num muted" style={{ width: 44, fontSize: 14 }}>{ar(b.death)}هـ</span>
              <div className="grow"><div className="title">{b.title}</div><div className="meta">{b.author}</div></div>
              <span className="end">{count(counts.get(b.id) ?? 0, 'نص', 'نصان', 'نصوص', 'نصاً')}</span>
              <Icon.ChevronIn />
            </Link>
          ))}
        </div>
      )}
      {!books.length && !adding && <div className="empty card">لا توجد كتب بعد.</div>}
    </>
  )
}

export function BookPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { bookById, books, passages, links, analysis, issueById, science } = useStore()
  const book = bookById.get(id)
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState(false)
  if (!book) return <div className="empty">هذا الكتاب غير موجود. <Link to="/books">كل الكتب</Link></div>

  const own = passages.filter(p => p.bookId === id).map(p => analysis.passages.get(p.id)!).filter(Boolean)
  const parent = analysis.parent.get(id)
  const others = analysis.edges.filter(e => e.to === id && e !== parent)
  const children = analysis.edges.filter(e => e.from === id)
  const root = analysis.rootOf(id)
  const family = books.filter(b => b.id !== id && b.id !== root && analysis.rootOf(b.id) === root)
  const declared = links.filter(l => l.from === id || l.to === id)
  const issuesOf = (items: { issueId: string; sim: number }[]) =>
    items.map(i => `${issueById.get(i.issueId)?.name.replace(/^تعريف /, '') ?? ''} ${pct(i.sim)}`).join('، ')
  const B = ({ bid }: { bid: string }) => <Link to={`/books/${bid}`}>{bookById.get(bid)?.title}</Link>

  async function remove() {
    await db.transaction('rw', db.books, db.passages, db.links, async () => {
      await db.passages.where({ bookId: id }).delete()
      await db.links.where('from').equals(id).delete()
      await db.links.where('to').equals(id).delete()
      await db.books.delete(id)
    })
    nav('/books')
  }

  return (
    <>
      <PageHead back="/books" title={book.title}
        sub={[book.author, yr(book) + (book.deathNote ? ` (${book.deathNote})` : ''), book.school, book.kind].filter(Boolean).join(' · ')}
        action={<button className="icon-btn" onClick={() => setEditing(e => !e)} aria-label="تعديل الكتاب"><Icon.Edit /></button>} />
      {editing && (
        <div className="stack tight">
          <BookForm book={book} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
          <ConfirmButton label="حذف الكتاب" confirm={`تُحذف معه ${count(own.length, 'نص', 'نصان', 'نصوص', 'نصاً')}. متأكد؟`} onConfirm={remove} />
        </div>
      )}

      <Link className="btn primary" to={`/add?book=${id}`}><Icon.Plus />نص من هذا الكتاب</Link>

      <div className="card">
        <div className="section-label" style={{ margin: 0 }}>الأصل المستنتج من النصوص</div>
        {parent ? <div><B bid={parent.from} /> <span className="small muted">في {issuesOf(parent.items)}</span></div>
          : <span className="muted small">{own.length ? 'لا يظهر له أصل في النصوص المحفوظة.' : 'أضف نصوصاً منه ليظهر نسبه.'}</span>}
        {family.length > 0 || root !== id ? (
          <>
            <div className="section-label" style={{ margin: 0 }}>العائلة المعرفية</div>
            <div className="small">{root === id ? 'هو رأس عائلته' : <>رأسها <B bid={root} /></>}
              {family.length > 0 && <span className="muted">، ومعه فيها: {family.map(b => b.title).join('، ')}</span>}</div>
          </>
        ) : null}
        {others.length > 0 && (
          <>
            <div className="section-label" style={{ margin: 0 }}>صلات أخرى مستنتجة</div>
            {others.map(e => <div key={e.from}><B bid={e.from} /> <span className="small muted">في {issuesOf(e.items)}</span></div>)}
          </>
        )}
        {children.length > 0 && (
          <>
            <div className="section-label" style={{ margin: 0 }}>استفاد منه</div>
            {children.map(e => <div key={e.to}><B bid={e.to} /> <span className="small muted">في {issuesOf(e.items)}</span></div>)}
          </>
        )}
      </div>

      <div className="stack tight">
        <div className="page-head" style={{ minHeight: 0 }}>
          <div className="section-label" style={{ margin: 0 }}>الصلات المعلنة</div>
          <button className="btn sm ghost" onClick={() => setLinking(l => !l)}><Icon.Plus />صلة</button>
        </div>
        {linking && <LinkForm bookId={id} scienceId={science!.id} onDone={() => setLinking(false)} />}
        {declared.length ? (
          <div className="list">
            {declared.map(l => (
              <div className="item" key={l.id} style={{ cursor: 'default' }}>
                <div className="grow">
                  <div className="title">{l.to === id ? <>أخذ عن <B bid={l.from} /></> : <>أخذ منه <B bid={l.to} /></>}</div>
                  {l.note && <div className="meta">{l.note}</div>}
                </div>
                <button className="icon-btn" onClick={() => db.links.delete(l.id)} aria-label="حذف الصلة"><Icon.Trash /></button>
              </div>
            ))}
          </div>
        ) : !linking && <span className="small muted">مثل: شرح، اختصار، أو نص المصنف في مقدمته على مصادره.</span>}
      </div>

      <div className="stack tight">
        <div className="section-label">نصوصه</div>
        {own.length ? (
          <div className="list">
            {own.map(a => (
              <Link key={a.passage.id} className="item" to={`/issues/${a.passage.issueId}#${a.passage.id}`}>
                <div className="grow"><div className="title">{issueById.get(a.passage.issueId)?.name}</div>
                  {a.source && <div className="meta">عن {a.source.book.title} · {pct(a.source.cmp.sim)}</div>}</div>
                <Badge relation={a.relation} manual={a.manual} />
              </Link>
            ))}
          </div>
        ) : <div className="empty card">لا نصوص من هذا الكتاب بعد.</div>}
      </div>
    </>
  )
}

function LinkForm({ bookId, scienceId, onDone }: { bookId: string; scienceId: string; onDone: () => void }) {
  const { books } = useStore()
  const [dir, setDir] = useState<'from' | 'to'>('from')
  const [other, setOther] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!other) return setError('اختر الكتاب الآخر.')
    await db.links.add({
      id: newId(), scienceId, note: note.trim(), createdAt: Date.now(),
      from: dir === 'from' ? other : bookId, to: dir === 'from' ? bookId : other,
    })
    onDone()
  }
  return (
    <form className="card" onSubmit={submit} noValidate>
      <div className="row">
        <label className="field"><span>نوع الصلة</span>
          <select id="lf-dir" className="select" value={dir} onChange={e => setDir(e.target.value as 'from' | 'to')}>
            <option value="from">أخذ هذا الكتاب عن</option>
            <option value="to">أخذ من هذا الكتاب</option>
          </select>
        </label>
        <label className="field"><span>الكتاب</span>
          <select id="lf-other" className="select" value={other} onChange={e => { setOther(e.target.value); setError('') }}>
            <option value="">اختر</option>
            {books.filter(b => b.id !== bookId).map(b => <option key={b.id} value={b.id}>{b.title} ({yr(b)})</option>)}
          </select>
        </label>
      </div>
      <label className="field"><span>المستند</span><input id="lf-note" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="الحاصل اختصار للمحصول" /></label>
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row"><button className="btn primary" type="submit">إضافة الصلة</button><button className="btn" type="button" onClick={onDone}>إلغاء</button></div>
    </form>
  )
}
