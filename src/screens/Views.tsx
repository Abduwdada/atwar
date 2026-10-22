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

  // ترتيب الصفوف بحيث يأتي كل كتاب تحت أصله
  const kids = new Map(books.map(b => [b.id, [] as string[]]))
  books.forEach(b => { const p = analysis.parent.get(b.id); if (p) kids.get(p.from)?.push(b.id) })
  const order: string[] = []
  const visit = (id: string) => { order.push(id); kids.get(id)!.forEach(visit) }
  books.filter(b => !analysis.parent.has(b.id)).forEach(b => visit(b.id))

  const minY = Math.floor(books[0].death / 100) * 100
  const maxY = Math.ceil((books.at(-1)!.death + 1) / 100) * 100
  // فجوة القرون الخالية من الكتب تُطوى حتى لا يتسع الرسم بلا فائدة
  const centuries: number[] = []
  for (let c = minY; c < maxY; c += 100) if (books.some(b => b.death >= c && b.death < c + 100)) centuries.push(c)
  const W = 980, padL = 160, padR = 48, top = 64, rowH = 54
  const H = top + order.length * rowH + 16
  const span = (W - padL - padR) / centuries.length
  const X = (y: number) => {
    const c = Math.floor(y / 100) * 100
    const i = centuries.indexOf(c)
    return W - padR - (i + (y - c) / 100) * span
  }
  const pos = new Map(order.map((id, i) => [id, { x: X(books.find(b => b.id === id)!.death), y: top + i * rowH + rowH / 2 }]))
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }, bend: number) => {
    const x1 = a.x - 11, x2 = b.x + 11, dx = Math.max(30, (x1 - x2) / 2)
    return `M${x1},${a.y} C${x1 - dx},${a.y + bend} ${x2 + dx},${b.y + bend} ${x2},${b.y}`
  }
  const title = (id: string) => books.find(b => b.id === id)?.title ?? ''

  return (
    <>
      <PageHead title="شجرة الكتب" sub="الزمن من اليمين إلى اليسار" />
      <div className="legend">
        <label className="check"><input id="tg-inf" type="checkbox" checked={showInf} onChange={e => setShowInf(e.target.checked)} /><span className="swl" />مستنتجة من النصوص</label>
        <label className="check"><input id="tg-dec" type="checkbox" checked={showDec} onChange={e => setShowDec(e.target.checked)} /><span className="swl dash" />معلنة</label>
        {schools.map(s => <span key={s}><i className="sw-dot" style={{ background: colorOf(s) }} />{s}</span>)}
      </div>
      <div className="svgwrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="شجرة الكتب على خط زمني">
          <defs>
            <marker id="arA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" /></marker>
            <marker id="arG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--gold)" /></marker>
          </defs>
          {centuries.map((c, i) => {
            const x = W - padR - i * span
            const gap = i > 0 && centuries[i - 1] !== c - 100
            return (
              <g key={c}>
                <line x1={x} y1={top - 14} x2={x} y2={H - 8} stroke="var(--line)" strokeDasharray={gap ? '2 4' : undefined} />
                <text x={x - 6} y={top - 24} textAnchor="start" fontSize="12" fill="var(--muted)" fontFamily="var(--f-ui)" direction="rtl">{gap ? '… ' : ''}{ar(c)}هـ</text>
              </g>
            )
          })}
          {showDec && links.map(l => pos.has(l.from) && pos.has(l.to) && (
            <path key={l.id} d={curve(pos.get(l.from)!, pos.get(l.to)!, 10)} fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#arG)">
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
          {order.map(id => {
            const b = books.find(x => x.id === id)!
            const p = pos.get(id)!
            const has = withTexts.has(id)
            return (
              <g key={id} className={'node' + (sel === id ? ' sel' : '')} tabIndex={0} role="button" aria-label={b.title}
                onClick={() => setSel(id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSel(id)}>
                <circle cx={p.x} cy={p.y} r="8" fill={has ? colorOf(b.school) : 'var(--surface)'} style={has ? undefined : { stroke: colorOf(b.school), strokeDasharray: '3 2' }} />
                <text x={p.x - 14} y={p.y + 1} textAnchor="end" fontFamily="var(--f-text)" fontSize="17" fontWeight="700" fill="var(--ink)">{b.title}</text>
                <text x={p.x - 14} y={p.y + 18} textAnchor="end" fontFamily="var(--f-ui)" fontSize="11.5" fill="var(--muted)">{`${b.author} · ${ar(b.death)}هـ`}</text>
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
