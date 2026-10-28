import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../data/db'
import { useStore } from '../data/store'
import { XLINK_TYPES, type Author, type Book } from '../data/types'
import { ConfirmButton, PageHead, ar, count } from '../ui/bits'
import { toNum } from '../ui/forms'
import * as Icon from '../ui/icons'

// كتب كل مؤلف موزعة على العلوم، ومنها يُعرف العلماء الجسور
export function useAuthorBooks() {
  const { allBooks, sciences } = useStore()
  return useMemo(() => {
    const visible = new Set(sciences.map(s => s.id))
    const m = new Map<string, Book[]>()
    allBooks.filter(b => b.authorId && visible.has(b.scienceId)).forEach(b => m.set(b.authorId!, [...(m.get(b.authorId!) ?? []), b]))
    return m
  }, [allBooks, sciences])
}

export function AuthorList() {
  const { authors, sciences } = useStore()
  const byAuthor = useAuthorBooks()
  const [q, setQ] = useState('')
  const [bridgeOnly, setBridgeOnly] = useState(false)
  const sciName = new Map(sciences.map(s => [s.id, s.name]))
  const t = q.trim()
  const list = authors
    .map(a => ({ a, books: byAuthor.get(a.id) ?? [] }))
    .map(x => ({ ...x, scis: [...new Set(x.books.map(b => b.scienceId))] }))
    .filter(x => x.books.length || !bridgeOnly)
    .filter(x => (!t || x.a.name.includes(t)) && (!bridgeOnly || x.scis.length > 1))

  return (
    <>
      <PageHead title="المؤلفون" sub="سجل واحد لكل العلوم، بترتيب سنة الوفاة" />
      <div className="toolbar-row">
        <div className="search grow"><Icon.Search /><input id="authors-q" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث باسم المؤلف" /></div>
      </div>
      <div className="controls">
        <label className="check ctl-check"><input id="authors-bridge" type="checkbox" checked={bridgeOnly} onChange={e => setBridgeOnly(e.target.checked)} />من صنّف في أكثر من علم فقط</label>
        <span className="ctl-count">{count(list.length, 'مؤلف', 'مؤلفان', 'مؤلفين', 'مؤلفاً')}</span>
      </div>
      {list.length ? (
        <div className="list">
          {list.map(({ a, books, scis }) => (
            <Link key={a.id} className="item" to={`/authors/${a.id}`}>
              <span className="num muted year-col">{a.death ? `${ar(a.death)}هـ` : '—'}</span>
              <div className="grow">
                <div className="title">{a.name} {scis.length > 1 && <span className="badge s2">في {count(scis.length, 'علم', 'علمين', 'علوم', 'علماً')}</span>}</div>
                <div className="meta">{scis.map(id => sciName.get(id)).join('، ') || 'لا كتب منشورة له بعد'}</div>
              </div>
              <span className="end">{count(books.length, 'كتاب', 'كتابان', 'كتب', 'كتاباً')}</span>
              <Icon.ChevronIn />
            </Link>
          ))}
        </div>
      ) : <div className="empty card">{authors.length ? 'لا مؤلفين يطابقون البحث.' : 'يُبنى السجل تلقائياً من كتب العلوم.'}</div>}
    </>
  )
}

export function AuthorPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { authorById, authors, sciences, xlinks, allBooks, canEdit } = useStore()
  const byAuthor = useAuthorBooks()
  const author = authorById.get(id)
  const [editing, setEditing] = useState(false)
  const [merging, setMerging] = useState(false)
  if (!author) return <div className="empty">هذا المؤلف غير موجود. <Link to="/authors">المؤلفون</Link></div>

  const books = byAuthor.get(id) ?? []
  const sciName = new Map(sciences.map(s => [s.id, s.name]))
  const groups = sciences.map(s => ({ s, items: books.filter(b => b.scienceId === s.id) })).filter(g => g.items.length)
  const mine = new Set(books.map(b => b.id))
  const bookById = new Map(allBooks.map(b => [b.id, b]))
  const rel = xlinks.filter(x => mine.has(x.from) || mine.has(x.to))
  const bookLink = (b: Book) => <Link to={`/s/${b.scienceId}/books/${b.id}`}>{b.title}</Link>

  async function remove() {
    await db.authors.delete(id)
    nav('/authors')
  }

  return (
    <>
      <PageHead back="/authors" title={author.name}
        sub={[author.death && `ت ${ar(author.death)}هـ`, groups.length > 1 && `صنّف في ${count(groups.length, 'علم', 'علمين', 'علوم', 'علماً')}`].filter(Boolean).join(' · ')}
        action={canEdit && <button className="icon-btn" onClick={() => setEditing(e => !e)} aria-label="تعديل المؤلف"><Icon.Edit /></button>} />
      {author.bio && !editing && <p className="muted" style={{ margin: 0, maxWidth: '70ch' }}>{author.bio}</p>}
      {editing && <AuthorForm author={author} onDone={() => setEditing(false)} />}
      {editing && (
        <div className="row">
          <button className="btn sm" onClick={() => setMerging(m => !m)}>دمج مع مؤلف آخر</button>
          {!books.length && <ConfirmButton label="حذف المؤلف" confirm="حذف هذا المؤلف من السجل؟" onConfirm={remove} />}
        </div>
      )}
      {merging && <MergeForm author={author} others={authors.filter(a => a.id !== id)} onDone={target => nav(`/authors/${target}`)} />}

      <section className="stack tight">
        <div className="section-label">كتبه في العلوم</div>
        {groups.length ? groups.map(({ s, items }) => (
          <div className="card" key={s.id}>
            <strong style={{ fontFamily: 'var(--f-brand)', fontSize: 20 }}>{s.name}</strong>
            <div className="list">
              {items.map(b => (
                <Link key={b.id} className="item" to={`/s/${b.scienceId}/books/${b.id}`}>
                  <div className="grow"><div className="title">{b.title}</div>{b.kind && <div className="meta">{b.kind}</div>}</div>
                  <Icon.ChevronIn />
                </Link>
              ))}
            </div>
          </div>
        )) : <div className="empty card">لا كتب منشورة له بعد.</div>}
      </section>

      {rel.length > 0 && (
        <section className="stack tight">
          <div className="section-label">صلات كتبه بعلوم أخرى</div>
          <div className="list">
            {rel.map(x => {
              const a = bookById.get(x.from), b = bookById.get(x.to)
              if (!a || !b) return null
              return (
                <div className="item" key={x.id} style={{ cursor: 'default' }}>
                  <div className="grow">
                    <div className="title"><span className="badge s2">{XLINK_TYPES[x.type]}</span> {bookLink(a)} <span className="muted small">({sciName.get(a.scienceId)})</span> ← {bookLink(b)} <span className="muted small">({sciName.get(b.scienceId)})</span></div>
                    {x.note && <div className="meta">{x.note}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

function AuthorForm({ author, onDone }: { author: Author; onDone: () => void }) {
  const [name, setName] = useState(author.name)
  const [death, setDeath] = useState(author.death ? ar(author.death) : '')
  const [bio, setBio] = useState(author.bio ?? '')
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    const d = death.trim() ? toNum(death) : undefined
    if (!name.trim()) return setError('اكتب اسم المؤلف.')
    if (d !== undefined && (!Number.isInteger(d) || d < 1 || d > 1500)) return setError('سنة الوفاة رقم بالهجري، مثل ٥٠٥.')
    await db.transaction('rw', db.authors, db.books, async () => {
      await db.authors.update(author.id, { name: name.trim(), death: d, bio: bio.trim() || undefined })
      // الاسم المعروض في كتبه يتبع السجل
      await db.books.filter(b => b.authorId === author.id).modify({ author: name.trim() })
    })
    onDone()
  }
  return (
    <form className="card" onSubmit={submit} noValidate>
      <div className="row">
        <label className="field"><span>الاسم</span><input id="af-name" className="input" value={name} onChange={e => { setName(e.target.value); setError('') }} /></label>
        <label className="field"><span>سنة الوفاة (هـ)</span><input id="af-death" className="input num" inputMode="numeric" value={death} onChange={e => { setDeath(e.target.value); setError('') }} placeholder="مثل ٥٠٥" /></label>
      </div>
      <label className="field"><span>تعريف قصير</span><textarea id="af-bio" className="input" style={{ minHeight: 80 }} value={bio} onChange={e => setBio(e.target.value)} placeholder="اختياري: مذهبه وأبرز شيوخه وتلاميذه" /></label>
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row"><button className="btn primary" type="submit">حفظ</button><button className="btn" type="button" onClick={onDone}>إلغاء</button></div>
    </form>
  )
}

// دمج مؤلفين سُجّلا باسمين، مثل «الغزالي» و«أبو حامد الغزالي»: تنتقل الكتب إلى الباقي ويُحذف الآخر
function MergeForm({ author, others, onDone }: { author: Author; others: Author[]; onDone: (target: string) => void }) {
  const [target, setTarget] = useState('')
  const t = others.find(a => a.id === target)
  async function merge() {
    if (!t) return
    await db.transaction('rw', db.authors, db.books, async () => {
      await db.books.filter(b => b.authorId === author.id).modify({ authorId: t.id, author: t.name })
      await db.authors.delete(author.id)
    })
    onDone(t.id)
  }
  return (
    <div className="card">
      <span className="small muted">تنتقل كتب «{author.name}» إلى المؤلف الذي تختاره، ويُحذف هذا الاسم من السجل.</span>
      <select id="merge-target" className="select" value={target} onChange={e => setTarget(e.target.value)}>
        <option value="">اختر المؤلف</option>
        {others.map(a => <option key={a.id} value={a.id}>{a.name}{a.death ? ` (ت ${ar(a.death)}هـ)` : ''}</option>)}
      </select>
      {t && <button className="btn primary" onClick={merge}>دمج في «{t.name}»</button>}
    </div>
  )
}
