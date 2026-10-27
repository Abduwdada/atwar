import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { sp } from '../nav'
import { useStore } from '../data/store'
import { RELATIONS } from '../engine/compare'
import { Badge, ar, count, yr } from '../ui/bits'

export default function Home() {
  const { books, issues, passages, analysis, bookById, issueById, hasSample, canEdit } = useStore()

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

  return (
    <>
      {hasSample && (
        <div className="note"><span><strong>عينة تجريبية: </strong>النصوص المعروضة الآن مكتوبة من الذاكرة لتجربة المنصة، ولم تُقابل بالطبعات المحققة بعد.</span></div>
      )}

      {books.length > 1 && <Strip />}

      <div className="split">
        <section className="stack tight">
          <div className="section-head"><h2>المسائل الأكثر تطوراً</h2><Link to={sp('/issues')}>كل المسائل</Link></div>
          {topIssues.length ? (
            <div className="list">
              {topIssues.map(({ issue, list }) => (
                <Link key={issue.id} className="item" to={sp(`/issues/${issue.id}`)}>
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
          <div className="section-head"><h2>الكتب الأكثر أثراً فيمن بعدها</h2><Link to={sp('/tree')}>الشجرة</Link></div>
          {influential.length ? (
            <div className="list">
              {influential.map(({ book, weight }) => (
                <Link key={book.id} className="item" to={sp(`/books/${book.id}`)}>
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
                <Link key={p.id} className="item" to={sp(`/issues/${p.issueId}#${p.id}`)}>
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
                  <Link key={b.id} to={sp(`/books/${b.id}`)} className={'pin' + (withTexts.has(b.id) ? '' : ' hollow')} title={`${b.author} · ${yr(b)}`}>
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
