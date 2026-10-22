import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './data/store'
import * as Icon from './ui/icons'
import Home from './screens/Home'
import Add from './screens/Add'
import { IssueList, IssuePage } from './screens/Issues'
import { BookList, BookPage } from './screens/Books'
import PassageEdit from './screens/PassageEdit'
import { Compare, Matrix, Tree } from './screens/Views'
import More from './screens/More'
import Search from './screens/Search'

// صفحات النماذج تبقى بعرض القراءة، وصفحات الاستعراض تتسع على الشاشة الكبيرة
const NARROW = ['/add', '/more', '/passages']

function SideSearch() {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  return (
    <form className="search side-search" onSubmit={e => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q.trim())}`); setQ('') }}>
      <Icon.Search />
      <input id="side-q" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="بحث" aria-label="بحث" />
    </form>
  )
}

function Shell() {
  const { pathname, search, key, hash } = useLocation()
  const { ready, loadError, canEdit, dirty, science } = useStore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!hash) window.scrollTo(0, 0) }, [pathname])
  useEffect(() => { document.title = science ? `أطوار · ${science.name}` : 'أطوار' }, [science])
  const narrow = NARROW.some(p => pathname.startsWith(p))

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="الأقسام">
        <div className="brand">أطوار<small>رصد تطور العلوم عبر نصوصها</small></div>
        <SideSearch />
        {canEdit && <NavLink className="btn primary" to="/add"><Icon.Plus />إضافة نص</NavLink>}
        <NavLink to="/" end><Icon.Home />{science?.name ?? 'الرئيسية'}</NavLink>
        <NavLink to="/issues"><Icon.Issues />المسائل</NavLink>
        <NavLink to="/books"><Icon.Books />الكتب</NavLink>
        <NavLink to="/matrix"><Icon.Grid />المصفوفة</NavLink>
        <NavLink to="/tree"><Icon.Tree />شجرة الكتب</NavLink>
        <NavLink to="/compare"><Icon.Compare />مقارنة نصين</NavLink>
        <NavLink to="/more"><Icon.More />المزيد{canEdit && dirty && <span className="dot" title="تعديلات لم تُنشر" />}</NavLink>
        <div className="side-foot small muted">{canEdit ? (dirty ? 'عندك تعديلات لم تُنشر' : 'وضع المؤلف') : 'نتائج منشورة للباحثين'}</div>
      </nav>

      <main className={'main' + (narrow ? '' : ' wide')}>
        {loadError && !ready ? (
          <div className="empty card">{loadError} تأكد من الاتصال بالإنترنت ثم أعد فتح الصفحة.</div>
        ) : ready ? (
          <Routes>
            <Route path="/" element={<Home />} />
            {/* مفتاح البحث يعيد بناء شاشة الإضافة عند الانتقال من نص إلى آخر */}
            <Route path="/add" element={canEdit ? <Add key={search + key} /> : <Navigate to="/more" replace />} />
            <Route path="/issues" element={<IssueList />} />
            <Route path="/issues/:id" element={<IssuePage />} />
            <Route path="/books" element={<BookList />} />
            <Route path="/books/:id" element={<BookPage />} />
            <Route path="/passages/:id/edit" element={canEdit ? <PassageEdit /> : <Navigate to="/" replace />} />
            <Route path="/matrix" element={<Matrix />} />
            <Route path="/tree" element={<Tree />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/search" element={<Search key={search} />} />
            <Route path="/more" element={<More />} />
            <Route path="*" element={<Home />} />
          </Routes>
        ) : <div className="empty">جارٍ التحميل…</div>}
      </main>

      <nav className="tabbar" aria-label="الأقسام">
        <NavLink to="/" end><Icon.Home /><span>الرئيسية</span></NavLink>
        <NavLink to="/issues"><Icon.Issues /><span>المسائل</span></NavLink>
        {canEdit
          ? <NavLink to="/add" className="add" aria-label="إضافة نص"><span className="plus"><Icon.Plus /></span></NavLink>
          : <NavLink to="/search"><Icon.Search /><span>البحث</span></NavLink>}
        <NavLink to="/books"><Icon.Books /><span>الكتب</span></NavLink>
        <NavLink to="/more"><Icon.More /><span>المزيد</span>{canEdit && dirty && <span className="dot" />}</NavLink>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </HashRouter>
  )
}
