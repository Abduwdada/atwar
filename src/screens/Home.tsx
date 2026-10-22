import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { Badge, ar } from '../ui/bits'
import * as Icon from '../ui/icons'

export default function Home() {
  const { science, sciences, setScienceId, books, issues, passages, analysis, bookById, issueById, hasSample } = useStore()
  const recent = [...passages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)

  return (
    <>
      <div className="page-head">
        <h1 style={{ fontFamily: 'var(--f-brand)', fontSize: 34, fontWeight: 700 }}>أطوار</h1>
        {sciences.length > 1 ? (
          <select id="home-science" className="select" style={{ width: 'auto', minHeight: 40 }} value={science?.id} onChange={e => setScienceId(e.target.value)} aria-label="العلم">
            {sciences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : <span className="muted">{science?.name}</span>}
      </div>

      <Link to="/add" className="btn primary block" style={{ minHeight: 56, fontSize: 17 }}><Icon.Plus />إضافة نص</Link>

      <div className="stats">
        <Link className="stat" to="/books"><b>{ar(books.length)}</b><span>كتب</span></Link>
        <Link className="stat" to="/issues"><b>{ar(issues.length)}</b><span>مسائل</span></Link>
        <Link className="stat" to="/matrix"><b>{ar(passages.length)}</b><span>نصوص</span></Link>
      </div>

      {hasSample && (
        <div className="note">
          <span><strong>عينة تجريبية: </strong>نصوص مكتوبة من الذاكرة للتجربة. تقدر تحذفها من «المزيد» متى ما بدأت بنصوصك.</span>
        </div>
      )}

      <div className="stack tight">
        <div className="section-label">آخر ما أُضيف</div>
        {recent.length ? (
          <div className="list">
            {recent.map(p => {
              const a = analysis.passages.get(p.id)
              return (
                <Link key={p.id} className="item" to={`/issues/${p.issueId}#${p.id}`}>
                  <div className="grow">
                    <div className="title">{issueById.get(p.issueId)?.name}</div>
                    <div className="meta">{bookById.get(p.bookId)?.title}</div>
                  </div>
                  {a && <Badge relation={a.relation} manual={a.manual} />}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="empty card">ما أضفت نصوصاً بعد. ابدأ بأول تعريف من أي كتاب.</div>
        )}
      </div>

      <div className="stack tight">
        <div className="section-label">استعراض</div>
        <div className="list">
          <Link className="item" to="/matrix"><Icon.Grid /><div className="grow"><div className="title">المصفوفة</div><div className="meta">المسائل والكتب في جدول واحد</div></div><Icon.ChevronIn /></Link>
          <Link className="item" to="/tree"><Icon.Tree /><div className="grow"><div className="title">شجرة الكتب</div><div className="meta">النسب والعائلات المعرفية</div></div><Icon.ChevronIn /></Link>
          <Link className="item" to="/compare"><Icon.Compare /><div className="grow"><div className="title">مقارنة نصين</div><div className="meta">أي نصين من بياناتك</div></div><Icon.ChevronIn /></Link>
        </div>
      </div>
    </>
  )
}
