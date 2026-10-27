import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { RELATIONS } from '../engine/compare'
import { Badge, ar, count, yr } from '../ui/bits'
import * as Icon from '../ui/icons'
import { PublishBar } from './More'

export default function Home() {
  const { science, sciences, setScienceId, books, issues, passages, analysis, bookById, issueById, hasSample, canEdit, links } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')

  // المسائل الأكثر تطوراً: أكثرها نصوصاً، ثم أكثرها تنوعاً في العلاقات
  const topIssues = useMemo(() => issues.map(i => {
    const list = passages.filter(p => p.issueId === i.id).map(p => analysis.passages.get(p.id)!).filter(Boolean)
      .sort((a, b) => a.book.death - b.book.death)
    return { issue: i, list }
  }).filter(x => x.list.length).sort((a, b) => b.list.length - a.list.length).slice(0, 6), [issues, passages, analysis])

  // الكتب الأكثر أثراً: مجموع ما أُخذ عنها في الكتب اللاحقة
  const influential = useMemo(() => {
    const w = new Map<string, number>()
    analysis.edges.forEach(e => w.set(e.from, (w.get(e.from) ?? 0) + e.weight))
    return [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, weight]) => ({ book: bookById.get(id)!, weight }))
      .filter(x => x.book)
  }, [analysis, bookById])

  const recent = [...passages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)
  const first = books[0], last = books.at(-1)

  return (
    <>
      <section className="hero">
        <div className="hero-top">
          <Link to="/" className="eyebrow" style={{ textDecoration: 'none' }}>أطوار · العلوم المرصودة</Link>
          {sciences.length > 1 && (
            <select id="home-science" className="select" style={{ width: 'auto', minHeight: 38 }} value={science?.id} onChange={e => setScienceId(e.target.value)} aria-label="العلم">
              {sciences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
        <h1>{science?.name}</h1>
        <p className="lede">
          تتبّع نضج المسائل والمصطلحات عبر الكتب بترتيبها الزمني، وما نقله كل مصنف عمن قبله وما زاد عليه أو استدركه.
          {first && last && first !== last && <> من <b className="num">{ar(first.death)}هـ</b> إلى <b className="num">{ar(last.death)}هـ</b>.</>}
        </p>
        <form className="search hero-search" onSubmit={e => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q.trim())}`) }}>
          <Icon.Search />
          <input id="home-q" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث في النصوص والكتب والمسائل" aria-label="بحث" />
        </form>
      </section>

      {canEdit && <PublishBar />}
      {canEdit && <Link to="/add" className="btn primary block only-mobile" style={{ minHeight: 56, fontSize: 17 }}><Icon.Plus />إضافة نص</Link>}

      <div className="stats">
        <Link className="stat" to="/books"><b>{ar(books.length)}</b><span>كتب</span></Link>
        <Link className="stat" to="/issues"><b>{ar(issues.length)}</b><span>مسائل</span></Link>
        <Link className="stat" to="/matrix"><b>{ar(passages.length)}</b><span>نصوص</span></Link>
        <Link className="stat only-wide" to="/tree"><b>{ar(analysis.edges.length + links.length)}</b><span>صلات بين الكتب</span></Link>
      </div>

      {hasSample && (
        <div className="note"><span><strong>عينة تجريبية: </strong>النصوص المعروضة الآن مكتوبة من الذاكرة لتجربة المنصة، ولم تُقابل بالطبعات المحققة بعد.</span></div>
      )}

      {books.length > 1 && <Strip />}

      <div className="split">
        <section className="stack tight">
          <div className="section-head"><h2>المسائل الأكثر تطوراً</h2><Link to="/issues">كل المسائل</Link></div>
          {topIssues.length ? (
            <div className="list">
              {topIssues.map(({ issue, list }) => (
                <Link key={issue.id} className="item" to={`/issues/${issue.id}`}>
                  <div className="grow">
                    <div className="title">{issue.name}</div>
                    <div className="meta">{count(list.length, 'نص', 'نصان', 'نصوص', 'نصاً')} · من {list[0].book.title} إلى {list.at(-1)!.book.title}</div>
                  </div>
                  <span className="chain" aria-label="علاقات النصوص بالترتيب الزمني">
                    {list.map(a => <i key={a.passage.id} className={`s${RELATIONS[a.relation].strength < 0 ? 'f' : RELATIONS[a.relation].strength}`} title={`${a.book.title}: ${RELATIONS[a.relation].label}`} />)}
                  </span>
                </Link>
              ))}
            </div>
          ) : <div className="empty card">لم تُنشر نصوص بعد.</div>}
        </section>

        <section className="stack tight">
          <div className="section-head"><h2>الكتب الأكثر أثراً فيمن بعدها</h2><Link to="/tree">الشجرة</Link></div>
          {influential.length ? (
            <div className="list">
              {influential.map(({ book, weight }) => (
                <Link key={book.id} className="item" to={`/books/${book.id}`}>
                  <span className="num muted" style={{ width: 48, fontSize: 14 }}>{ar(book.death)}هـ</span>
                  <div className="grow"><div className="title">{book.title}</div><div className="meta">{book.author}</div></div>
                  <span className="bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (weight / influential[0].weight) * 100)}%` }} /></span>
                </Link>
              ))}
            </div>
          ) : <div className="empty card">تظهر بعد إضافة نصوص من كتب متعاقبة.</div>}
        </section>
      </div>

      {recent.length > 0 && (
        <section className="stack tight">
          <div className="section-head"><h2>{canEdit ? 'آخر ما أضفت' : 'آخر ما نُشر'}</h2></div>
          <div className="list">
            {recent.map(p => {
              const a = analysis.passages.get(p.id)
              return (
                <Link key={p.id} className="item" to={`/issues/${p.issueId}#${p.id}`}>
                  <div className="grow"><div className="title">{issueById.get(p.issueId)?.name}</div><div className="meta">{bookById.get(p.bookId)?.title}</div></div>
                  {a && <Badge relation={a.relation} manual={a.manual} />}
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر']

// شريط زمني للكتب مرتبة بالقرون، ولكل كتاب علامة تنقل إلى صفحته
function Strip() {
  const { books, passages } = useStore()
  const withTexts = new Set(passages.map(p => p.bookId))
  const centuries = [...new Set(books.map(b => Math.floor(b.death / 100) * 100))].sort((a, b) => a - b)
  return (
    <section className="stack tight">
      <div className="section-head"><h2>مسيرة العلم</h2><span className="small muted">كل قرن فيه كتب، مرتبة بسنة الوفاة</span></div>
      <div className="strip-wrap">
        <div className="strip">
          {centuries.map(c => (
            <div className="century" key={c}>
              <div className="century-label num">القرن {ORD[c / 100] ?? ar(c / 100 + 1)}<small>{ar(c)}–{ar(c + 100)}هـ</small></div>
              <div className="century-books">
                {books.filter(b => Math.floor(b.death / 100) * 100 === c).map(b => (
                  <Link key={b.id} to={`/books/${b.id}`} className={'pin' + (withTexts.has(b.id) ? '' : ' hollow')} title={`${b.author} · ${yr(b)}`}>
                    <span className="pin-title">{b.title}</span>
                    <span className="pin-year num">{ar(b.death)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
