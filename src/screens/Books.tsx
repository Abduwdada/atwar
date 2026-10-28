import { useMemo, useState, type FormEvent } from 'react'
import { sp } from '../nav'
import { useListPrefs } from '../data/prefs'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, newId } from '../data/db'
import { useStore } from '../data/store'
import { Badge, ConfirmButton, PageHead, ar, count, pct, yr } from '../ui/bits'
import { BookForm } from '../ui/forms'
import { XLINK_TYPES, type Book, type XLinkType } from '../data/types'
import * as Icon from '../ui/icons'

const CENTURY = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر']
const centuryName = (d: number) => `القرن ${CENTURY[Math.floor(d / 100)] ?? ar(Math.floor(d / 100) + 1)}`

export function BookList() {
  const { books, passages, canEdit } = useStore()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const nav = useNavigate()
  const [o, set] = useListPrefs('books', { sort: 'death', school: '', kind: '', group: true })
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    passages.forEach(p => m.set(p.bookId, (m.get(p.bookId) ?? 0) + 1))
    return m
  }, [passages])
  const schools = [...new Set(books.map(b => b.school).filter(Boolean))] as string[]
  const kinds = [...new Set(books.map(b => b.kind).filter(Boolean))] as string[]
  const t = q.trim()
  const shown = books
    .filter(b => (!t || b.title.includes(t) || b.author.includes(t)) && (!o.school || b.school === o.school) && (!o.kind || b.kind === o.kind))
    .sort((x, y) => o.sort === 'title' ? x.title.localeCompare(y.title, 'ar')
      : o.sort === 'texts' ? (counts.get(y.id) ?? 0) - (counts.get(x.id) ?? 0)
      : o.sort === 'death-desc' ? y.death - x.death : x.death - y.death)
  const byCentury = o.group && o.sort.startsWith('death')
  const groups: [string, typeof shown][] = byCentury
    ? [...shown.reduce((m, b) => m.set(centuryName(b.death), [...(m.get(centuryName(b.death)) ?? []), b]), new Map<string, typeof shown>())]
    : [['', shown]]

  return (
    <section className="stack">
      <div className="toolbar-row">
        <div className="search grow"><Icon.Search /><input id="books-q" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالعنوان أو المؤلف" /></div>
        {canEdit && <button className="btn primary" onClick={() => setAdding(a => !a)}><Icon.Plus />إضافة كتاب</button>}
      </div>
      {adding && <BookForm onSaved={b => nav(sp(`/books/${b.id}`))} onCancel={() => setAdding(false)} />}
      <div className="controls">
        <label className="ctl"><span>الترتيب</span>
          <select id="books-sort" value={o.sort} onChange={e => set('sort', e.target.value)}>
            <option value="death">الأقدم وفاةً أولاً</option>
            <option value="death-desc">الأحدث وفاةً أولاً</option>
            <option value="title">العنوان</option>
            <option value="texts">الأكثر نصوصاً</option>
          </select>
        </label>
        {schools.length > 1 && (
          <label className="ctl"><span>المذهب</span>
            <select id="books-school" value={o.school} onChange={e => set('school', e.target.value)}>
              <option value="">الكل</option>{schools.map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
        )}
        {kinds.length > 1 && (
          <label className="ctl"><span>النوع</span>
            <select id="books-kind" value={o.kind} onChange={e => set('kind', e.target.value)}>
              <option value="">الكل</option>{kinds.map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
        )}
        {o.sort.startsWith('death') && (
          <label className="check ctl-check"><input id="books-group" type="checkbox" checked={o.group} onChange={e => set('group', e.target.checked)} />تجميع بالقرون</label>
        )}
        <span className="ctl-count">{count(shown.length, 'كتاب', 'كتابان', 'كتب', 'كتاباً')}</span>
      </div>
      {groups.map(([label, list]) => (
        <div className="stack tight" key={label || 'all'}>
          {label && <div className="section-label">{label}</div>}
          <div className="list">
            {list.map(b => (
              <Link key={b.id} className="item" to={sp(`/books/${b.id}`)}>
                <span className="num muted year-col">{ar(b.death)}هـ</span>
                <div className="grow"><div className="title">{b.title}</div><div className="meta">{[b.author, b.school, b.kind].filter(Boolean).join(' · ')}</div></div>
                <span className="end">{count(counts.get(b.id) ?? 0, 'نص', 'نصان', 'نصوص', 'نصاً')}</span>
                <Icon.ChevronIn />
              </Link>
            ))}
          </div>
        </div>
      ))}
      {!shown.length && <div className="empty card">{books.length ? 'لا كتب تطابق البحث أو التصفية.' : canEdit ? 'ابدأ بإضافة أول كتاب في هذا العلم.' : 'لم تُنشر كتب بعد.'}</div>}
    </section>
  )
}

export function BookPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { bookById, books, passages, links, analysis, issueById, science, canEdit, authorById } = useStore()
  const book = bookById.get(id)
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState(false)
  if (!book) return <div className="empty">هذا الكتاب غير موجود. <Link to={sp('/books')}>كل الكتب</Link></div>

  const own = passages.filter(p => p.bookId === id).map(p => analysis.passages.get(p.id)!).filter(Boolean)
  const parent = analysis.parent.get(id)
  const others = analysis.edges.filter(e => e.to === id && e !== parent)
  const children = analysis.edges.filter(e => e.from === id)
  const root = analysis.rootOf(id)
  const family = books.filter(b => b.id !== id && b.id !== root && analysis.rootOf(b.id) === root)
  const declared = links.filter(l => l.from === id || l.to === id)
  const issuesOf = (items: { issueId: string; sim: number }[]) =>
    items.map(i => `${issueById.get(i.issueId)?.name.replace(/^تعريف /, '') ?? ''} ${pct(i.sim)}`).join('، ')
  const B = ({ bid }: { bid: string }) => <Link to={sp(`/books/${bid}`)}>{bookById.get(bid)?.title}</Link>

  async function remove() {
    await db.transaction('rw', [db.books, db.passages, db.links, db.xlinks], async () => {
      await db.passages.where({ bookId: id }).delete()
      await db.xlinks.where('from').equals(id).delete()
      await db.xlinks.where('to').equals(id).delete()
      await db.links.where('from').equals(id).delete()
      await db.links.where('to').equals(id).delete()
      await db.books.delete(id)
    })
    nav(sp('/books'))
  }

  return (
    <>
      <PageHead back={sp("/books")} title={book.title}
        sub={<>{book.authorId && authorById.has(book.authorId) ? <Link to={`/authors/${book.authorId}`}>{book.author}</Link> : book.author}{' · ' + [yr(book) + (book.deathNote ? ` (${book.deathNote})` : ''), book.school, book.kind].filter(Boolean).join(' · ')}</>}
        action={canEdit && <button className="icon-btn" onClick={() => setEditing(e => !e)} aria-label="تعديل الكتاب"><Icon.Edit /></button>} />
      {editing && (
        <div className="stack tight">
          <BookForm book={book} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
          <ConfirmButton label="حذف الكتاب" confirm={`تُحذف معه ${count(own.length, 'نص', 'نصان', 'نصوص', 'نصاً')}. متأكد؟`} onConfirm={remove} />
        </div>
      )}

      {canEdit && <Link className="btn primary" to={sp(`/add?book=${id}`)}><Icon.Plus />نص من هذا الكتاب</Link>}

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
          {canEdit && <button className="btn sm ghost" onClick={() => setLinking(l => !l)}><Icon.Plus />صلة</button>}
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
                {canEdit && <button className="icon-btn" onClick={() => db.links.delete(l.id)} aria-label="حذف الصلة"><Icon.Trash /></button>}
              </div>
            ))}
          </div>
        ) : !linking && <span className="small muted">{canEdit ? 'مثل: شرح، اختصار، أو نص المصنف في مقدمته على مصادره.' : 'لا صلات معلنة مسجلة لهذا الكتاب.'}</span>}
      </div>

      <CrossScience book={book} />

      <div className="stack tight">
        <div className="section-label">نصوصه</div>
        {own.length ? (
          <div className="list">
            {own.map(a => (
              <Link key={a.passage.id} className="item" to={sp(`/issues/${a.passage.issueId}#${a.passage.id}`)}>
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
      <label className="field"><span>المستند</span><input id="lf-note" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="مثل: شرحٌ عليه، أو اختصارٌ له، أو نصّ المؤلف في مقدمته" /></label>
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row"><button className="btn primary" type="submit">إضافة الصلة</button><button className="btn" type="button" onClick={onDone}>إلغاء</button></div>
    </form>
  )
}

// صلات الكتاب بعلوم أخرى: كتب مؤلفه في غيرها، والصلات المسجلة بين العلوم
function CrossScience({ book }: { book: Book }) {
  const { allBooks, xlinks, sciences, canEdit, authorById } = useStore()
  const [adding, setAdding] = useState(false)
  const sciName = new Map(sciences.map(s => [s.id, s.name]))
  const visible = new Set(sciences.map(s => s.id))
  const byId = new Map(allBooks.map(b => [b.id, b]))
  const sameAuthor = book.authorId ? allBooks.filter(b => b.authorId === book.authorId && b.scienceId !== book.scienceId && visible.has(b.scienceId)) : []
  const rel = xlinks.filter(x => x.from === book.id || x.to === book.id).filter(x => byId.has(x.from) && byId.has(x.to))
  const go = (b: Book) => <Link to={`/s/${b.scienceId}/books/${b.id}`}>{b.title}</Link>
  if (!canEdit && !sameAuthor.length && !rel.length) return null
  return (
    <div className="stack tight">
      <div className="page-head" style={{ minHeight: 0 }}>
        <div className="section-label" style={{ margin: 0 }}>صلاته بعلوم أخرى</div>
        {canEdit && <button className="btn sm ghost" onClick={() => setAdding(a => !a)}><Icon.Plus />صلة بعلم آخر</button>}
      </div>
      {adding && <XLinkForm book={book} onDone={() => setAdding(false)} />}
      {(sameAuthor.length > 0 || rel.length > 0) ? (
        <div className="list">
          {sameAuthor.map(b => (
            <div className="item" key={'a' + b.id} style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="title"><span className="badge mine">المؤلف نفسه</span> {go(b)} <span className="muted small">في {sciName.get(b.scienceId)}</span></div>
                <div className="meta">{authorById.get(book.authorId!)?.name} صنّف في هذا العلم أيضاً</div>
              </div>
            </div>
          ))}
          {rel.map(x => {
            const other = byId.get(x.from === book.id ? x.to : x.from)!
            return (
              <div className="item" key={x.id} style={{ cursor: 'default' }}>
                <div className="grow">
                  <div className="title"><span className="badge s2">{XLINK_TYPES[x.type]}</span> {x.from === book.id ? 'أثّر في' : 'أخذ عن'} {go(other)} <span className="muted small">في {sciName.get(other.scienceId) ?? 'علم غير منشور'}</span></div>
                  {x.note && <div className="meta">{x.note}</div>}
                </div>
                {canEdit && <button className="icon-btn" onClick={() => db.xlinks.delete(x.id)} aria-label="حذف الصلة"><Icon.Trash /></button>}
              </div>
            )
          })}
        </div>
      ) : !adding && <span className="small muted">مثل: انتقال منهج من المنطق إلى الأصول، أو نقل مصطلح من الأصول إلى النحو.</span>}
    </div>
  )
}

function XLinkForm({ book, onDone }: { book: Book; onDone: () => void }) {
  const { sciences, allBooks } = useStore()
  const others = sciences.filter(s => s.id !== book.scienceId)
  const [sci, setSci] = useState(others[0]?.id ?? '')
  const [other, setOther] = useState('')
  const [dir, setDir] = useState<'from' | 'to'>('from')
  const [type, setType] = useState<XLinkType>('method')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const candidates = allBooks.filter(b => b.scienceId === sci).sort((a, b) => a.death - b.death)
  if (!others.length) return <div className="card small muted">أضف علماً آخر أولاً لتربط به هذا الكتاب.</div>
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!other) return setError('اختر الكتاب من العلم الآخر.')
    await db.xlinks.add({ id: newId(), from: dir === 'from' ? other : book.id, to: dir === 'from' ? book.id : other, type, note: note.trim(), createdAt: Date.now() })
    onDone()
  }
  return (
    <form className="card" onSubmit={submit} noValidate>
      <div className="row">
        <label className="field"><span>العلم الآخر</span>
          <select id="xl-sci" className="select" value={sci} onChange={e => { setSci(e.target.value); setOther('') }}>
            {others.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="field"><span>الكتاب</span>
          <select id="xl-book" className="select" value={other} onChange={e => { setOther(e.target.value); setError('') }}>
            <option value="">اختر</option>
            {candidates.map(b => <option key={b.id} value={b.id}>{b.title} ({yr(b)})</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="field"><span>الاتجاه</span>
          <select id="xl-dir" className="select" value={dir} onChange={e => setDir(e.target.value as 'from' | 'to')}>
            <option value="from">أخذ هذا الكتاب عنه</option>
            <option value="to">أثّر هذا الكتاب فيه</option>
          </select>
        </label>
        <label className="field"><span>نوع الصلة</span>
          <select id="xl-type" className="select" value={type} onChange={e => setType(e.target.value as XLinkType)}>
            {(Object.keys(XLINK_TYPES) as XLinkType[]).map(k => <option key={k} value={k}>{XLINK_TYPES[k]}</option>)}
          </select>
        </label>
      </div>
      <label className="field"><span>المستند</span><input id="xl-note" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="مثل: المقدمة المنطقية في أول الكتاب" /></label>
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row"><button className="btn primary" type="submit">إضافة الصلة</button><button className="btn" type="button" onClick={onDone}>إلغاء</button></div>
    </form>
  )
}
