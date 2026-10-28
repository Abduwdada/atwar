import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { sp } from '../nav'
import { useStore } from '../data/store'
import { RELATIONS } from '../engine/compare'
import { ar, count, yr } from '../ui/bits'
import PhaseBar from '../ui/PhaseBar'
import { phaseOf } from '../engine/phases'
import { XLINK_TYPES, type Book } from '../data/types'

export default function Home() {
  const { books, issues, passages, analysis, bookById, hasSample, science, canEdit } = useStore()

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


  return (
    <>
      {hasSample && (
        <div className="note"><span><strong>عينة تجريبية: </strong>النصوص المعروضة الآن مكتوبة من الذاكرة لتجربة المنصة، ولم تُقابل بالطبعات المحققة بعد.</span></div>
      )}

      {science?.phases?.length ? (
        <section className="stack tight">
          <div className="section-head"><h2>مراحل تطور العلم</h2>{canEdit && <Link to={sp('/settings')}>تعديل</Link>}</div>
          <PhaseBar phases={science.phases} books={books} />
        </section>
      ) : canEdit && books.length >= 3 ? (
        <p className="note"><span>حدّد مراحل تطور هذا العلم، أو اقترحها من بياناته، من <Link to={sp('/settings')}>إعدادات العلم</Link>.</span></p>
      ) : null}

      {books.length > 1 && <Strip />}

      {science?.mode === 'books' ? <MethodsSummary /> : <div className="split">
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
      </div>}

      <CrossTimeline />

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

// مناهج التأليف في علوم الكتب: أول ظهور كل منهج وعدد كتبه
function MethodsSummary() {
  const { books, lists } = useStore()
  const rows = lists.methods.map(m => {
    const list = books.filter(b => b.method === m).sort((a, b) => a.death - b.death)
    return { m, list }
  }).filter(r => r.list.length)
  return (
    <section className="stack tight">
      <div className="section-head"><h2>مناهج التأليف</h2><Link to={sp('/methods')}>التفصيل</Link></div>
      {rows.length ? (
        <div className="list">
          {rows.map(({ m, list }) => (
            <Link key={m} className="item" to={sp('/methods')}>
              <div className="grow"><div className="title">{m}</div><div className="meta">أول ظهور: {list[0].title} ({yr(list[0])})</div></div>
              <span className="end">{count(list.length, 'كتاب', 'كتابان', 'كتب', 'كتاباً')}</span>
            </Link>
          ))}
        </div>
      ) : <div className="empty card">حدّد طريقة التأليف لكل كتاب ليظهر تطور المناهج.</div>}
    </section>
  )
}

// متى احتاج هذا العلم إلى غيره، أو احتاج غيره إليه، مرتباً بالزمن ومع مرحلة العلم حينئذ
function CrossTimeline() {
  const { science, allBooks, xlinks, sciences, authorById } = useStore()
  if (!science) return null
  const sciName = new Map(sciences.map(s => [s.id, s.name]))
  const byId = new Map(allBooks.map(b => [b.id, b]))
  const visible = new Set(sciences.map(s => s.id))
  const mine = allBooks.filter(b => b.scienceId === science.id)
  type Row = { year: number; here: Book; other: Book; label: string; dir: 'in' | 'out' | 'author'; note?: string }
  const rows: Row[] = []
  xlinks.forEach(x => {
    const a = byId.get(x.from), b = byId.get(x.to)
    if (!a || !b || !visible.has(a.scienceId) || !visible.has(b.scienceId)) return
    if (b.scienceId === science.id && a.scienceId !== science.id) rows.push({ year: b.death, here: b, other: a, label: XLINK_TYPES[x.type], dir: 'in', note: x.note })
    else if (a.scienceId === science.id && b.scienceId !== science.id) rows.push({ year: b.death, here: a, other: b, label: XLINK_TYPES[x.type], dir: 'out', note: x.note })
  })
  mine.forEach(b => {
    if (!b.authorId) return
    allBooks.filter(o => o.authorId === b.authorId && o.scienceId !== science.id && visible.has(o.scienceId))
      .forEach(o => rows.push({ year: b.death, here: b, other: o, label: 'المؤلف نفسه', dir: 'author', note: authorById.get(b.authorId!)?.name }))
  })
  if (!rows.length) return null
  rows.sort((a, b) => a.year - b.year)
  return (
    <section className="stack tight">
      <div className="section-head"><h2>صلاته بالعلوم الأخرى عبر الزمن</h2></div>
      <div className="list">
        {rows.map((r, i) => {
          const ph = phaseOf(science.phases, r.year)
          return (
            <div className="item" key={i} style={{ cursor: 'default' }}>
              <span className="num muted year-col">{ar(r.year)}هـ</span>
              <div className="grow">
                <div className="title">
                  <span className={'badge ' + (r.dir === 'author' ? 'mine' : 's2')}>{r.label}</span>{' '}
                  <Link to={sp(`/books/${r.here.id}`)}>{r.here.title}</Link>
                  {r.dir === 'in' ? ' أخذ عن ' : r.dir === 'out' ? ' أثّر في ' : ' ومؤلفه صنّف '}
                  <Link to={`/s/${r.other.scienceId}/books/${r.other.id}`}>{r.other.title}</Link>
                  <span className="muted small"> ({sciName.get(r.other.scienceId)})</span>
                </div>
                <div className="meta">{[ph && `في مرحلة ${ph.name}`, r.dir !== 'author' && r.note].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
