import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useEffect, type ReactElement } from 'react'
import { StoreProvider, useStore } from './data/store'
import { PrefsProvider } from './data/prefs'
import * as Icon from './ui/icons'
import Landing from './screens/Landing'
import { AuthorList, AuthorPage } from './screens/Authors'
import EvolutionMap from './screens/EvolutionMap'
import ScienceShell from './screens/ScienceShell'
import Home from './screens/Home'
import Add from './screens/Add'
import { IssueList, IssuePage } from './screens/Issues'
import { BookList, BookPage } from './screens/Books'
import PassageEdit from './screens/PassageEdit'
import { Compare, Matrix, Methods, Tree } from './screens/Views'
import Settings, { ScienceSettings } from './screens/More'
import Search from './screens/Search'
import { groupSciences } from './ui/SciencesManager'

// الروابط القديمة قبل أن يصير لكل علم صفحته: تُحوَّل إلى العلم المفتوح آخر مرة
function Legacy({ to }: { to: string }) {
  const { science, sciences } = useStore()
  const params = useParams()
  const { search, hash } = useLocation()
  const sid = science?.id ?? sciences[0]?.id
  if (!sid) return <Navigate to="/" replace />
  const path = to.replace(':id', params.id ?? '')
  return <Navigate to={`/s/${sid}${path}${search}${hash}`} replace />
}

function SubKeyed({ el }: { el: (key: string) => ReactElement }) {
  const { search, key } = useLocation()
  return el(search + key)
}

function Shell() {
  const { pathname, hash } = useLocation()
  const { ready, loadError, canEdit, dirty, science, sciences, groups } = useStore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!hash) window.scrollTo(0, 0) }, [pathname])
  const inScience = pathname.startsWith('/s/')
  useEffect(() => { document.title = science && inScience ? `أطوار · ${science.name}` : 'أطوار' }, [science, inScience])
  const narrow = ['/settings', '/add', '/passages'].some(p => pathname === p || pathname.includes(p + '/') || pathname.endsWith(p))
  const sid = science?.id ?? sciences[0]?.id

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="الأقسام">
        <NavLink to="/" end className="brand">أطوار<small>رصد تطور العلوم عبر نصوصها</small></NavLink>
        <NavLink to="/" end><Icon.Home />العلوم</NavLink>
        <NavLink to="/map"><Icon.Tree />خارطة التطور</NavLink>
        <NavLink to="/authors"><Icon.Books />المؤلفون</NavLink>
        {groupSciences(sciences, groups).map(({ group, items }) => (
          <div key={group?.id ?? 'rest'} className="side-block">
            <div className="side-group">{group?.name ?? (groups.length ? 'علوم أخرى' : 'العلوم المرصودة')}</div>
            {items.map(s => <NavLink key={s.id} to={`/s/${s.id}`} className={'side-sci' + (s.hidden ? ' is-hidden' : '')}>{s.name}{s.hidden && <Icon.EyeOff />}</NavLink>)}
          </div>
        ))}
        <div className="side-spacer" />
        <NavLink to="/settings"><Icon.Settings />الإعدادات{canEdit && dirty && <span className="dot" title="تعديلات لم تُنشر" />}</NavLink>
        <div className="side-foot small muted">
          {canEdit ? (dirty ? <NavLink to="/settings" className="pending">تعديلات لم تُنشر · انشرها</NavLink> : 'وضع المؤلف · كل شيء منشور') : 'نتائج منشورة للباحثين'}
        </div>
      </nav>

      <main className={'main' + (narrow ? '' : ' wide')}>
        {loadError && !ready ? (
          <div className="empty card">{loadError} تأكد من الاتصال بالإنترنت ثم أعد فتح الصفحة.</div>
        ) : ready ? (
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/map" element={<EvolutionMap />} />
            <Route path="/authors" element={<AuthorList />} />
            <Route path="/authors/:id" element={<AuthorPage />} />
            <Route path="/s/:sid" element={<ScienceShell />}>
              <Route index element={<Home />} />
              <Route path="books" element={<BookList />} />
              <Route path="books/:id" element={<BookPage />} />
              <Route path="issues" element={<IssueList />} />
              <Route path="issues/:id" element={<IssuePage />} />
              <Route path="matrix" element={<Matrix />} />
              <Route path="tree" element={<Tree />} />
              <Route path="compare" element={<Compare />} />
              <Route path="methods" element={<Methods />} />
              <Route path="search" element={<SubKeyed el={k => <Search key={k} />} />} />
              <Route path="settings" element={canEdit ? <ScienceSettings /> : <Navigate to=".." replace />} />
              {/* مفتاح البحث يعيد بناء شاشة الإضافة عند الانتقال من نص إلى آخر */}
              <Route path="add" element={canEdit ? (science?.mode === 'books' ? <Navigate to="../books?new=1" replace /> : <SubKeyed el={k => <Add key={k} />} />) : <Navigate to="/settings" replace />} />
              <Route path="passages/:id/edit" element={canEdit ? <PassageEdit /> : <Navigate to=".." replace />} />
            </Route>
            <Route path="/science" element={<Legacy to="" />} />
            <Route path="/books" element={<Legacy to="/books" />} />
            <Route path="/books/:id" element={<Legacy to="/books/:id" />} />
            <Route path="/issues" element={<Legacy to="/issues" />} />
            <Route path="/issues/:id" element={<Legacy to="/issues/:id" />} />
            <Route path="/matrix" element={<Legacy to="/matrix" />} />
            <Route path="/tree" element={<Legacy to="/tree" />} />
            <Route path="/compare" element={<Legacy to="/compare" />} />
            <Route path="/search" element={<Legacy to="/search" />} />
            <Route path="/add" element={<Legacy to="/add" />} />
            <Route path="/more" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        ) : <div className="empty">جارٍ التحميل…</div>}
      </main>

      <nav className="tabbar" aria-label="الأقسام">
        <NavLink to="/" end><Icon.Home /><span>العلوم</span></NavLink>
        {sid && <NavLink to={`/s/${sid}`}><Icon.Overview /><span className="tab-sci">{science?.name ?? 'العلم'}</span></NavLink>}
        {canEdit && sid
          ? <NavLink to={`/s/${sid}/add`} className="add" aria-label="إضافة نص"><span className="plus"><Icon.Plus /></span></NavLink>
          : sid && <NavLink to={`/s/${sid}/search`}><Icon.Search /><span>البحث</span></NavLink>}
        <NavLink to="/settings"><Icon.Settings /><span>الإعدادات</span>{canEdit && dirty && <span className="dot" />}</NavLink>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <PrefsProvider>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </PrefsProvider>
    </HashRouter>
  )
}
