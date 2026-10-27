import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { tokenize } from '../engine/arabic'
import { compare } from '../engine/compare'
import { Badge, DiffText, PageHead, ar, pct, yr } from '../ui/bits'

export function Matrix() {
  const { books, issues, passages, analysis } = useStore()
  const cell = useMemo(() => {
    const m = new Map<string, string>()
    passages.forEach(p => { if (!m.has(p.issueId + '|' + p.bookId)) m.set(p.issueId + '|' + p.bookId, p.id) })
    return m
  }, [passages])
  const usedBooks = books

  return (
    <>
      <PageHead title="المصفوفة" sub="المسائل صفوفاً، والكتب أعمدةً مرتبة بسنة الوفاة" />
      {issues.length && usedBooks.length ? (
        <div className="scroller">
          <table className="matrix">
            <thead>
              <tr>
                <th className="corner">المسألة</th>
                {usedBooks.map(b => <th key={b.id}><Link to={`/books/${b.id}`}>{b.title}</Link><small>{yr(b)}</small></th>)}
              </tr>
            </thead>
            <tbody>
              {issues.map(i => (
                <tr key={i.id}>
                  <th className="rowh" scope="row">{i.section && <small>{i.section}</small>}<Link to={`/issues/${i.id}`}>{i.name}</Link></th>
                  {usedBooks.map(b => {
                    const pid = cell.get(i.id + '|' + b.id)
                    const a = pid ? analysis.passages.get(pid) : undefined
                    if (!a) return <td key={b.id} className="blank">—</td>
                    const words = a.passage.body.split(/\s+/)
                    return (
                      <td key={b.id}>
                        <Link to={`/issues/${i.id}#${a.passage.id}`}>
                          <span className="snip">{words.slice(0, 7).join(' ')}{words.length > 7 ? '…' : ''}</span>
                          <Badge relation={a.relation} manual={a.manual} />
                        </Link>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty card">تظهر المصفوفة بعد إضافة كتب ومسائل ونصوص.</div>}
    </>
  )
}

const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر']

export function Tree() {
  const { books, links, analysis, passages } = useStore()
  const [sel, setSel] = useState<string>('')
  const [showInf, setShowInf] = useState(true)
  const [showDec, setShowDec] = useState(true)
  const withTexts = new Set(passages.map(p => p.bookId))
  // لون لكل مذهب، بترتيب أول ظهوره زمنياً
  const schools = [...new Set(books.map(b => b.school || 'غير محدد'))]
  const colorOf = (s?: string) => `var(--cat-${(schools.indexOf(s || 'غير محدد') % 6) + 1})`

  if (!books.length) return <><PageHead title="شجرة الكتب" /><div className="empty card">أضف كتباً ونصوصاً لتظهر الشجرة.</div></>

  // الزمن يتنزّل من الأعلى: لكل كتاب صف بحسب سنة وفاته، فلا تتداخل الأسماء
  const row = new Map(books.map((b, i) => [b.id, i]))
  // والأعمدة كترتيب الشجرة: الفروع متجاورة، والأصل في وسط فروعه
  const kids = new Map(books.map(b => [b.id, [] as string[]]))
  books.forEach(b => { const p = analysis.parent.get(b.id); if (p) kids.get(p.from)?.push(b.id) })
  const col = new Map<string, number>()
  let slot = 0
  const place = (id: string): number => {
    const ks = kids.get(id)!
    if (!ks.length) { col.set(id, slot); return slot++ }
    const xs = ks.map(place)
    const x = (Math.min(...xs) + Math.max(...xs)) / 2
    col.set(id, x)
    return x
  }
  books.filter(b => !analysis.parent.has(b.id)).forEach(b => place(b.id))

  const colW = 150, rowH = 64, padR = 110, padL = 180, top = 24
  const W = padR + Math.max(slot - 1, 0) * colW + padL
  const H = top + books.length * rowH + 8
  const pos = new Map(books.map(b => [b.id, { x: W - padR - col.get(b.id)! * colW, y: top + row.get(b.id)! * rowH + rowH / 2 }]))
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }, bend: number) => {
    const y1 = a.y + 11, y2 = b.y - 11, dy = Math.max(24, (y2 - y1) / 2)
    return `M${a.x},${y1} C${a.x + bend},${y1 + dy} ${b.x + bend},${y2 - dy} ${b.x},${y2}`
  }
  const title = (id: string) => books.find(b => b.id === id)?.title ?? ''
  const century = (d: number) => Math.floor(d / 100)

  return (
    <>
      <PageHead title="شجرة الكتب" sub="الأقدم في الأعلى، وكل كتاب تحت أصله" />
      <div className="legend">
        <label className="check"><input id="tg-inf" type="checkbox" checked={showInf} onChange={e => setShowInf(e.target.checked)} /><span className="swl" />مستنتجة من النصوص</label>
        <label className="check"><input id="tg-dec" type="checkbox" checked={showDec} onChange={e => setShowDec(e.target.checked)} /><span className="swl dash" />معلنة</label>
        {schools.map(s => <span key={s}><i className="sw-dot" style={{ background: colorOf(s) }} />{s}</span>)}
      </div>
      <div className="svgwrap">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 1100) }} role="img" aria-label="شجرة الكتب، الأقدم في الأعلى">
          <defs>
            <marker id="arA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" /></marker>
            <marker id="arG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--gold)" /></marker>
          </defs>
          {books.map((b, i) => {
            if (i > 0 && century(books[i - 1].death) === century(b.death)) return null
            const y = top + i * rowH
            return (
              <g key={'c' + b.id}>
                {i > 0 && <line x1={8} y1={y} x2={W - 8} y2={y} stroke="var(--line)" />}
                <text x={W - 12} y={y + 22} textAnchor="end" fontSize="12.5" fontWeight="600" fill="var(--muted)" fontFamily="var(--f-ui)">القرن {ORD[century(b.death)] ?? ar(century(b.death) + 1)}</text>
              </g>
            )
          })}
          {showDec && links.map(l => pos.has(l.from) && pos.has(l.to) && (
            <path key={l.id} d={curve(pos.get(l.from)!, pos.get(l.to)!, 16)} fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#arG)">
              <title>{`${title(l.from)} ← ${title(l.to)}${l.note ? ': ' + l.note : ''}`}</title>
            </path>
          ))}
          {showInf && analysis.edges.map(e => {
            const isP = analysis.parent.get(e.to) === e
            return (
              <path key={e.from + e.to} d={curve(pos.get(e.from)!, pos.get(e.to)!, 0)} fill="none" stroke="var(--accent)"
                strokeOpacity={isP ? 0.95 : 0.4} strokeWidth={(isP ? 1.6 : 1) + Math.min(e.weight, 2) * 1.4} markerEnd="url(#arA)">
                <title>{`${title(e.from)} ← ${title(e.to)}: ${e.items.map(i => pct(i.sim)).join('، ')}`}</title>
              </path>
            )
          })}
          {books.map(b => {
            const p = pos.get(b.id)!
            const has = withTexts.has(b.id)
            return (
              <g key={b.id} className={'node' + (sel === b.id ? ' sel' : '')} tabIndex={0} role="button" aria-label={b.title}
                onClick={() => setSel(b.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSel(b.id)}>
                <circle cx={p.x} cy={p.y} r="9" fill={has ? colorOf(b.school) : 'var(--surface)'} style={has ? undefined : { stroke: colorOf(b.school), strokeDasharray: '3 2' }} />
                <text x={p.x - 16} y={p.y + 1} textAnchor="end" fontFamily="var(--f-text)" fontSize="17" fontWeight="700" fill="var(--ink)">{b.title}</text>
                <text x={p.x - 16} y={p.y + 18} textAnchor="end" fontFamily="var(--f-ui)" fontSize="11.5" fill="var(--muted)">{`${b.author} · ${ar(b.death)}هـ`}</text>
              </g>
            )
          })}
        </svg>
      </div>
      {sel ? (
        <div className="card">
          <div className="page-head" style={{ minHeight: 0 }}>
            <strong style={{ fontFamily: 'var(--f-text)', fontSize: 22 }}>{title(sel)}</strong>
            <Link className="btn sm" to={`/books/${sel}`}>صفحة الكتاب</Link>
          </div>
          <span className="small muted">
            {analysis.parent.get(sel) ? `أصله المستنتج: ${title(analysis.parent.get(sel)!.from)}` : 'لا يظهر له أصل في النصوص'}
            {` · رأس عائلته: ${title(analysis.rootOf(sel))}`}
          </span>
        </div>
      ) : <p className="small muted">اضغط أي كتاب لترى نسبه. الدائرة المفرغة كتاب لم تُدخل نصوصه بعد.</p>}
    </>
  )
}

export function Compare() {
  const { issues, passages, bookById, analysis } = useStore()
  const sorted = useMemo(() => [...passages].sort((a, b) => (bookById.get(a.bookId)?.death ?? 0) - (bookById.get(b.bookId)?.death ?? 0)), [passages, bookById])
  const [aId, setA] = useState(() => sorted[0]?.id ?? '')
  const [bId, setB] = useState(() => sorted.find(p => p.issueId === sorted[0]?.issueId && p.id !== sorted[0]?.id)?.id ?? '')
  const [free, setFree] = useState('')

  const options = issues.map(i => (
    <optgroup key={i.id} label={i.name}>
      {sorted.filter(p => p.issueId === i.id).map(p => { const b = bookById.get(p.bookId)!; return <option key={p.id} value={p.id}>{b.title} ({yr(b)})</option> })}
    </optgroup>
  ))

  let pa = passages.find(p => p.id === aId)
  let pb = passages.find(p => p.id === bId)
  if (pa && pb && bookById.get(pa.bookId)!.death > bookById.get(pb.bookId)!.death) [pa, pb] = [pb, pa]
  const r = pa && pb && pa !== pb ? compare(tokenize(pa.body), tokenize(pb.body)) : null

  // البحث عن أقرب نص لنص يلصقه الباحث دون حفظه
  const freeTk = tokenize(free)
  const ranked = freeTk.length > 1
    ? passages.map(p => ({ p, c: compare(analysis.passages.get(p.id)?.tokens ?? tokenize(p.body), freeTk) })).sort((x, y) => y.c.sim - x.c.sim).slice(0, 5)
    : []

  return (
    <>
      <PageHead title="مقارنة نصين" sub="يُعامل الأقدم منهما مصدراً" />
      <div className="row">
        <label className="field"><span>النص الأول</span><select id="cmp-a" className="select" value={aId} onChange={e => setA(e.target.value)}>{options}</select></label>
        <label className="field"><span>النص الثاني</span><select id="cmp-b" className="select" value={bId} onChange={e => setB(e.target.value)}>{options}</select></label>
      </div>
      {r && pa && pb ? (
        <>
          <div className="figs">
            <div className="fig"><b>{pct(r.sim)}</b><span>التشابه</span></div>
            <div className="fig"><b>{pct(r.covS)}</b><span>من ألفاظ {bookById.get(pa.bookId)!.title} في المتأخر</span></div>
            <div className="fig"><b>{pct(r.covT)}</b><span>من ألفاظ {bookById.get(pb.bookId)!.title} مأخوذة من المتقدم</span></div>
            <div className="fig"><b>{ar(bookById.get(pb.bookId)!.death - bookById.get(pa.bookId)!.death)}</b><span>سنة بين الوفاتين</span></div>
          </div>
          <div><Badge relation={r.relation} /></div>
          <div className="duo">
            <div className="card"><span className="small muted">المتقدم: {bookById.get(pa.bookId)!.title}</span><p className="text">{pa.body}</p></div>
            <div className="card"><span className="small muted">المتأخر: {bookById.get(pb.bookId)!.title}</span><p className="text"><DiffText ops={r.ops} novel={new Set()} /></p></div>
          </div>
        </>
      ) : <p className="muted">اختر نصين مختلفين.</p>}

      <div className="stack tight">
        <div className="section-label">ابحث عن أقرب نص لنص من عندك</div>
        <textarea id="cmp-free" className="textarea" style={{ minHeight: 110 }} value={free} onChange={e => setFree(e.target.value)} placeholder="الصق تعريفاً ليُقارن بكل النصوص المحفوظة دون حفظه" />
        {ranked.length > 0 && (
          <div className="list">
            {ranked.map(({ p, c }) => (
              <Link key={p.id} className="item" to={`/issues/${p.issueId}#${p.id}`}>
                <div className="grow"><div className="title">{bookById.get(p.bookId)?.title}</div><div className="meta">{issues.find(i => i.id === p.issueId)?.name}</div></div>
                <span className="num">{pct(c.sim)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
