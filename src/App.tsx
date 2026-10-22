import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StoreProvider, useStore } from './data/store'
import * as Icon from './ui/icons'
import Home from './screens/Home'
import Add from './screens/Add'
import { IssueList, IssuePage } from './screens/Issues'
import { BookList, BookPage } from './screens/Books'
import PassageEdit from './screens/PassageEdit'
import { Compare, Matrix, Tree } from './screens/Views'
import More from './screens/More'

const WIDE = ['/matrix', '/tree']

function Shell() {
  const { pathname, search, key, hash } = useLocation()
  const { ready } = useStore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!hash) window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="الأقسام">
        <div className="brand">أطوار<small>رصد تطور العلوم عبر نصوصها</small></div>
        <NavLink className="btn primary" to="/add"><Icon.Plus />إضافة نص</NavLink>
        <NavLink to="/" end><Icon.Home />الرئيسية</NavLink>
        <NavLink to="/issues"><Icon.Issues />المسائل</NavLink>
        <NavLink to="/books"><Icon.Books />الكتب</NavLink>
        <NavLink to="/matrix"><Icon.Grid />المصفوفة</NavLink>
        <NavLink to="/tree"><Icon.Tree />شجرة الكتب</NavLink>
        <NavLink to="/compare"><Icon.Compare />مقارنة نصين</NavLink>
        <NavLink to="/more"><Icon.More />المزيد</NavLink>
      </nav>

      <main className={'main' + (WIDE.includes(pathname) ? ' wide' : '')}>
        {ready ? (
          <Routes>
            <Route path="/" element={<Home />} />
            {/* مفتاح البحث يعيد بناء شاشة الإضافة عند الانتقال من نص إلى آخر */}
            <Route path="/add" element={<Add key={search + key} />} />
            <Route path="/issues" element={<IssueList />} />
            <Route path="/issues/:id" element={<IssuePage />} />
            <Route path="/books" element={<BookList />} />
            <Route path="/books/:id" element={<BookPage />} />
            <Route path="/passages/:id/edit" element={<PassageEdit />} />
            <Route path="/matrix" element={<Matrix />} />
            <Route path="/tree" element={<Tree />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/more" element={<More />} />
            <Route path="*" element={<Home />} />
          </Routes>
        ) : <div className="empty">جارٍ التحميل…</div>}
      </main>

      <nav className="tabbar" aria-label="الأقسام">
        <NavLink to="/" end><Icon.Home /><span>الرئيسية</span></NavLink>
        <NavLink to="/issues"><Icon.Issues /><span>المسائل</span></NavLink>
        <NavLink to="/add" className="add" aria-label="إضافة نص"><span className="plus"><Icon.Plus /></span></NavLink>
        <NavLink to="/books"><Icon.Books /><span>الكتب</span></NavLink>
        <NavLink to="/more"><Icon.More /><span>المزيد</span></NavLink>
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
