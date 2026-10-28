import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { setCurrentSid, sp } from '../nav'
import { ar, count } from '../ui/bits'
import * as Icon from '../ui/icons'

// صفحة العلم: رأس ثابت باسمه، وتحته تبويبات أقسامه
export default function ScienceShell() {
  const { sid = '' } = useParams()
  const { sciences, science, setScienceId, books, issues, passages, canEdit, ready } = useStore()
  setCurrentSid(sid)
  useEffect(() => { setScienceId(sid) }, [sid, setScienceId])
  // التبويب المفتوح يبقى ظاهراً في شريط التبويبات على الجوال
  const { pathname } = useLocation()
  useEffect(() => { document.querySelector('.sci-tabs a.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [pathname])

  if (!sciences.some(s => s.id === sid)) return <div className="empty card">هذا العلم غير موجود. <Link to="/">العلوم</Link></div>
  if (!ready || science?.id !== sid) return <div className="empty">جارٍ التحميل…</div>

  const first = books[0], last = books.at(-1)
  const byBooks = science.mode === 'books'
  const hasMethods = books.some(b => b.method)
  const tabs: [string, string][] = byBooks
    ? [['', 'نظرة عامة'], ['/books', 'الكتب'], ['/methods', 'مناهج التأليف'], ['/tree', 'الشجرة']]
    : [['', 'نظرة عامة'], ['/books', 'الكتب'], ['/issues', 'المسائل'], ['/matrix', 'المصفوفة'], ['/tree', 'الشجرة'], ['/compare', 'المقارنة'], ...(hasMethods ? [['/methods', 'مناهج التأليف'] as [string, string]] : [])]
  if (canEdit) tabs.push(['/settings', 'إعدادات العلم'])

  return (
    <div className="science">
      <header className="sci-head">
        <div className="sci-title">
          <Link to="/" className="eyebrow" style={{ textDecoration: 'none' }}>العلوم</Link>
          <h1>{science.name}</h1>
          {canEdit && science.hidden && <span className="badge mine" style={{ alignSelf: 'flex-start' }}><Icon.EyeOff />مخفي عن الزوار · غيّره من إعدادات العلم</span>}
          <span className="small muted">
            {(science.mode === 'books' ? [count(books.length, 'كتاب', 'كتابان', 'كتب', 'كتاباً')] : [count(books.length, 'كتاب', 'كتابان', 'كتب', 'كتاباً'), count(issues.length, 'مسألة', 'مسألتان', 'مسائل', 'مسألة'), count(passages.length, 'نص', 'نصان', 'نصوص', 'نصاً')]).join(' · ')}
            {first && last && first !== last && ` · من ${ar(first.death)}هـ إلى ${ar(last.death)}هـ`}
          </span>
          {science.description && <p className="sci-desc">{science.description}</p>}
        </div>
        <div className="sci-actions">
          <Link to={sp('/search')} className="icon-btn" aria-label="البحث في هذا العلم"><Icon.Search /></Link>
          {canEdit && (byBooks
            ? <Link to={sp('/books?new=1')} className="btn primary sm"><Icon.Plus />كتاب</Link>
            : <Link to={sp('/add')} className="btn primary sm"><Icon.Plus />نص</Link>)}
        </div>
      </header>
      <nav className="sci-tabs" aria-label="أقسام العلم">
        {tabs.map(([p, label]) => <NavLink key={p} to={sp(p)} end={p === ''}>{label}</NavLink>)}
      </nav>
      {/* إعادة بناء الأقسام عند الانتقال من علم إلى آخر */}
      <div key={sid} className="science-body"><Outlet /></div>
    </div>
  )
}
