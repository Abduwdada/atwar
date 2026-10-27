import { useMemo, useRef, useState } from 'react'
import { db } from '../data/db'
import * as Icon from '../ui/icons'
import { sp } from '../nav'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { tokenize } from '../engine/arabic'
import { compare } from '../engine/compare'
import { Badge, DiffText, ar, pct, yr } from '../ui/bits'
import { useListPrefs } from '../data/prefs'

export function Matrix() {
  const { books, issues, passages, analysis } = useStore()
  const cell = useMemo(() => {
    const m = new Map<string, string>()
    passages.forEach(p => { if (!m.has(p.issueId + '|' + p.bookId)) m.set(p.issueId + '|' + p.bookId, p.id) })
    return m
  }, [passages])
  const [o, set] = useListPrefs('matrix', { section: '', hideEmpty: true })
  const withTexts = new Set(passages.map(p => p.bookId))
  const usedBooks = o.hideEmpty ? books.filter(b => withTexts.has(b.id)) : books
  const sections = [...new Set(issues.map(i => i.section).filter(Boolean))] as string[]
  const rows = issues.filter(i => !o.section || i.section === o.section)

  return (
    <>
      <div className="controls">
        <span className="small muted">المسائل صفوفاً، والكتب أعمدةً بسنة الوفاة</span>
        {sections.length > 1 && (
          <label className="ctl"><span>الباب</span>
            <select id="matrix-section" value={o.section} onChange={e => set('section', e.target.value)}>
              <option value="">كل الأبواب</option>{sections.map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
        )}
        <label className="check ctl-check"><input id="matrix-empty" type="checkbox" checked={o.hideEmpty} onChange={e => set('hideEmpty', e.target.checked)} />إخفاء الكتب بلا نصوص</label>
      </div>
      {rows.length && usedBooks.length ? (
        <div className="scroller">
          <table className="matrix">
            <thead>
              <tr>
                <th className="corner">المسألة</th>
                {usedBooks.map(b => <th key={b.id}><Link to={sp(`/books/${b.id}`)}>{b.title}</Link><small>{yr(b)}</small></th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(i => (
                <tr key={i.id}>
                  <th className="rowh" scope="row">{i.section && <small>{i.section}</small>}<Link to={sp(`/issues/${i.id}`)}>{i.name}</Link></th>
                  {usedBooks.map(b => {
                    const pid = cell.get(i.id + '|' + b.id)
                    const a = pid ? analysis.passages.get(pid) : undefined
                    if (!a) return <td key={b.id} className="blank">—</td>
                    const words = a.passage.body.split(/\s+/)
                    return (
                      <td key={b.id}>
                        <Link to={sp(`/issues/${i.id}#${a.passage.id}`)}>
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

type Pt = { x: number; y: number }
type View = 'v' | 'h' | 'list'

export function Tree() {
  const { books, links, analysis, passages, science, canEdit, issueById } = useStore()
  const [sel, setSel] = useState<string>('')
  const [o, set] = useListPrefs('tree', { view: 'v' as View, inf: true, dec: true })
  const [zoom, setZoom] = useState(1)
  // مواضع يغيّرها الزائر بالسحب لنفسه، ومواضع المؤلف تُحفظ مع العلم وتُنشر
  const [local, setLocal] = useState<Record<string, Pt>>({})
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const withTexts = new Set(passages.map(p => p.bookId))
  const schools = [...new Set(books.map(b => b.school || 'غير محدد'))]
  const colorOf = (s?: string) => `var(--cat-${(schools.indexOf(s || 'غير محدد') % 6) + 1})`
  const view = o.view
  const setView = (v: View) => { set('view', v); setLocal({}); setSel('') }

  if (!books.length) return <div className="empty card">أضف كتباً ونصوصاً لتظهر الشجرة.</div>

  // الترتيب التلقائي: محور الزمن خطوة لكل كتاب بسنة وفاته، ومحور الفروع يجعل الفروع متجاورة وأصلها في وسطها
  const row = new Map(books.map((b, i) => [b.id, i]))
  const kids = new Map(books.map(b => [b.id, [] as string[]]))
  books.forEach(b => { const p = analysis.parent.get(b.id); if (p) kids.get(p.from)?.push(b.id) })
  const roots = books.filter(b => !analysis.parent.has(b.id))
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
  roots.forEach(b => place(b.id))
  const title = (id: string) => books.find(b => b.id === id)?.title ?? ''
  const century = (d: number) => Math.floor(d / 100)
  const centuryLabel = (d: number) => `القرن ${ORD[century(d)] ?? ar(century(d) + 1)}`

  const viewSwitch = (
    <div className="seg" role="radiogroup" aria-label="طريقة العرض">
      {([['v', 'عمودي'], ['h', 'أفقي'], ['list', 'قائمة متدرجة']] as [View, string][]).map(([v, label]) =>
        <button key={v} role="radio" aria-checked={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>)}
    </div>
  )

  if (view === 'list') {
    const Node = ({ id }: { id: string }) => {
      const b = books.find(x => x.id === id)!
      const e = analysis.parent.get(id)
      return (
        <li>
          <button className={'ol-item' + (sel === id ? ' sel' : '')} onClick={() => setSel(id)}>
            <i className="sw-dot" style={{ background: withTexts.has(id) ? colorOf(b.school) : 'transparent', boxShadow: `inset 0 0 0 1.5px ${colorOf(b.school)}` }} />
            <b>{b.title}</b>
            <span className="small muted">{b.author} · {ar(b.death)}هـ</span>
            {e && <span className="small muted ol-why">أخذ عن {title(e.from)} في {e.items.map(i => issueById.get(i.issueId)?.name.replace(/^تعريف /, '')).join('، ')}</span>}
          </button>
          {kids.get(id)!.length > 0 && <ul>{kids.get(id)!.map(k => <Node key={k} id={k} />)}</ul>}
        </li>
      )
    }
    return (
      <>
        <div className="controls">{viewSwitch}<span className="small muted">كل كتاب تحت أصله المستنتج، والجذور مرتبة بسنة الوفاة.</span></div>
        <ul className="outline">{roots.map(b => <Node key={b.id} id={b.id} />)}</ul>
        <SelectedBook sel={sel} title={title} />
      </>
    )
  }

  const V = view === 'v'
  const stepT = V ? 64 : 150, stepB = V ? 150 : 86
  const toXY = (t: number, b: number): Pt => (V ? { x: -b, y: t } : { x: -t, y: b })
  const tOf = (p: Pt) => (V ? p.y : -p.x)
  const auto = (id: string) => toXY(row.get(id)! * stepT, col.get(id)! * stepB)
  const saved = (V ? science?.treeLayout : science?.treeLayoutH) ?? {}
  const pos = new Map(books.map(b => [b.id, local[b.id] ?? saved[b.id] ?? auto(b.id)]))
  const customized = Object.keys(local).length > 0 || Object.keys(saved).length > 0

  // نطاق كل قرن على محور الزمن، ولا يخرج الكتاب المسحوب من نطاق قرنه
  const bands = new Map<number, [number, number]>()
  books.forEach((b, i) => {
    const c = century(b.death), cur = bands.get(c)
    bands.set(c, [cur ? cur[0] : i * stepT - stepT / 2, i * stepT + stepT / 2])
  })
  const clampT = (id: string, t: number) => {
    const [a, b] = bands.get(century(books.find(x => x.id === id)!.death))!
    // هامش يبقي اسم الكتاب نفسه داخل نطاق قرنه
    const [lo, hi] = V ? [16, 28] : [55, 55]
    return Math.min(b - hi, Math.max(a + lo, t))
  }

  const xs = [...pos.values()].map(p => p.x), ys = [...pos.values()].map(p => p.y)
  const allT = [...bands.values()].flat()
  const minX = V ? Math.min(...xs) - 200 : Math.min(...xs, -Math.max(...allT)) - 70
  const maxX = V ? Math.max(...xs) + 120 : Math.max(...xs, -Math.min(...allT)) + 70
  const minY = V ? Math.min(...ys, Math.min(...allT)) - 8 : Math.min(...ys) - 60
  const maxY = V ? Math.max(...ys, Math.max(...allT)) + 8 : Math.max(...ys) + 56
  const W = maxX - minX, H = maxY - minY

  const curve = (a: Pt, b: Pt, bend: number) => {
    if (V) {
      const down = b.y >= a.y, y1 = a.y + (down ? 11 : -11), y2 = b.y + (down ? -11 : 11), d = (y2 - y1) / 2
      return `M${a.x},${y1} C${a.x + bend},${y1 + d} ${b.x + bend},${y2 - d} ${b.x},${y2}`
    }
    const left = b.x <= a.x, x1 = a.x + (left ? -11 : 11), x2 = b.x + (left ? 11 : -11), d = (x2 - x1) / 2
    return `M${x1},${a.y} C${x1 + d},${a.y + bend} ${x2 - d},${b.y + bend} ${x2},${b.y}`
  }

  const toSvg = (e: React.PointerEvent): Pt => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svgRef.current!.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }
  function onDown(e: React.PointerEvent, id: string) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toSvg(e), cur = pos.get(id)!
    setDragging({ id, dx: p.x - cur.x, dy: p.y - cur.y, moved: false })
  }
  function onMove(e: React.PointerEvent) {
    if (!dragging) return
    const p = toSvg(e)
    let next = { x: Math.round(p.x - dragging.dx), y: Math.round(p.y - dragging.dy) }
    const t = clampT(dragging.id, tOf(next))
    next = V ? { x: next.x, y: t } : { x: -t, y: next.y }
    const cur = pos.get(dragging.id)!
    if (!dragging.moved && Math.hypot(next.x - cur.x, next.y - cur.y) < 4) return
    setDragging({ ...dragging, moved: true })
    setLocal(l => ({ ...l, [dragging.id]: next }))
  }
  async function onUp(id: string) {
    const d = dragging
    setDragging(null)
    if (!d?.moved) return setSel(id)
    if (canEdit && science) {
      await db.sciences.update(science.id, { [V ? 'treeLayout' : 'treeLayoutH']: { ...saved, [id]: local[id] } })
      setLocal(l => { const { [id]: _, ...rest } = l; return rest })
    }
  }
  async function resetLayout() {
    setLocal({})
    if (canEdit && science) await db.sciences.update(science.id, { [V ? 'treeLayout' : 'treeLayoutH']: undefined })
  }
  const fit = () => { const w = wrapRef.current?.clientWidth; if (w) setZoom(Math.max(0.3, Math.min(2, (w - 2) / W))) }
  const step = (f: number) => setZoom(z => Math.max(0.3, Math.min(2.5, +(z * f).toFixed(2))))

  return (
    <>
      <div className="controls">
        {viewSwitch}
        <span className="zoom-btns">
          <button className="icon-btn" onClick={() => step(1 / 1.2)} aria-label="تصغير"><Icon.Minus /></button>
          <span className="num small">{ar(Math.round(zoom * 100))}٪</span>
          <button className="icon-btn" onClick={() => step(1.2)} aria-label="تكبير"><Icon.Plus /></button>
          <button className="btn sm" onClick={fit}>ملاءمة الشاشة</button>
        </span>
        {customized && <button className="btn sm ghost" onClick={resetLayout}>الترتيب التلقائي</button>}
      </div>
      <div className="legend">
        <label className="check"><input id="tg-inf" type="checkbox" checked={o.inf} onChange={e => set('inf', e.target.checked)} /><span className="swl" />مستنتجة من النصوص</label>
        <label className="check"><input id="tg-dec" type="checkbox" checked={o.dec} onChange={e => set('dec', e.target.checked)} /><span className="swl dash" />معلنة</label>
        {schools.map(s => <span key={s}><i className="sw-dot" style={{ background: colorOf(s) }} />{s}</span>)}
        <span className="muted">اسحب أي كتاب لتحريكه داخل قرنه.{canEdit ? ' ترتيبك يُحفظ ويُنشر للزوار.' : ''}</span>
      </div>
      <div className="svgwrap" ref={wrapRef}>
        <svg ref={svgRef} viewBox={`${minX} ${minY} ${W} ${H}`} style={{ width: W * zoom, minWidth: 0, height: 'auto' }}
          role="img" aria-label={V ? 'شجرة الكتب، الأقدم في الأعلى' : 'شجرة الكتب، الأقدم على اليمين'} onPointerMove={onMove}>
          <defs>
            <marker id="arA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" /></marker>
            <marker id="arG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--gold)" /></marker>
          </defs>
          {[...bands.entries()].map(([c, [a, b]], i) => V ? (
            <g key={c}>
              {i % 2 === 1 && <rect x={minX} y={a} width={W} height={b - a} fill="var(--sunken)" opacity="0.5" />}
              <text x={maxX - 12} y={a + 22} textAnchor="end" fontSize="12.5" fontWeight="600" fill="var(--muted)" fontFamily="var(--f-ui)">{centuryLabel(c * 100)}</text>
            </g>
          ) : (
            <g key={c}>
              {i % 2 === 1 && <rect x={-b} y={minY} width={b - a} height={H} fill="var(--sunken)" opacity="0.5" />}
              <text x={-a - 8} y={minY + 22} textAnchor="end" fontSize="12.5" fontWeight="600" fill="var(--muted)" fontFamily="var(--f-ui)">{centuryLabel(c * 100)}</text>
            </g>
          ))}
          {o.dec && links.map(l => pos.has(l.from) && pos.has(l.to) && (
            <path key={l.id} d={curve(pos.get(l.from)!, pos.get(l.to)!, 16)} fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#arG)">
              <title>{`${title(l.from)} ← ${title(l.to)}${l.note ? ': ' + l.note : ''}`}</title>
            </path>
          ))}
          {o.inf && analysis.edges.map(e => {
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
            const w = b.title.length * 9 + 30
            return (
              <g key={b.id} className={'node draggable' + (sel === b.id ? ' sel' : '') + (dragging?.id === b.id ? ' grabbing' : '')} tabIndex={0} role="button" aria-label={b.title}
                onPointerDown={e => onDown(e, b.id)} onPointerUp={() => onUp(b.id)} onPointerCancel={() => setDragging(null)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSel(b.id)}>
                {V ? <rect x={p.x - w + 14} y={p.y - 16} width={w} height={40} fill="transparent" />
                  : <rect x={p.x - w / 2} y={p.y - 14} width={w} height={62} fill="transparent" />}
                <circle cx={p.x} cy={p.y} r="9" fill={has ? colorOf(b.school) : 'var(--surface)'} style={has ? undefined : { stroke: colorOf(b.school), strokeDasharray: '3 2' }} />
                {V ? (
                  <>
                    <text x={p.x - 16} y={p.y + 1} textAnchor="end" fontFamily="var(--f-text)" fontSize="17" fontWeight="700" fill="var(--ink)">{b.title}</text>
                    <text x={p.x - 16} y={p.y + 18} textAnchor="end" fontFamily="var(--f-ui)" fontSize="11.5" fill="var(--muted)">{`${b.author} · ${ar(b.death)}هـ`}</text>
                  </>
                ) : (
                  <>
                    <text x={p.x} y={p.y + 30} textAnchor="middle" fontFamily="var(--f-text)" fontSize="16" fontWeight="700" fill="var(--ink)">{b.title}</text>
                    <text x={p.x} y={p.y + 46} textAnchor="middle" fontFamily="var(--f-ui)" fontSize="11.5" fill="var(--muted)">{`${ar(b.death)}هـ`}</text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <SelectedBook sel={sel} title={title} />
    </>
  )
}

function SelectedBook({ sel, title }: { sel: string; title: (id: string) => string }) {
  const { analysis } = useStore()
  if (!sel) return <p className="small muted">اضغط أي كتاب لترى نسبه. الدائرة المفرغة كتاب لم تُدخل نصوصه بعد.</p>
  return (
    <div className="card">
      <div className="page-head" style={{ minHeight: 0 }}>
        <strong style={{ fontFamily: 'var(--f-text)', fontSize: 22 }}>{title(sel)}</strong>
        <Link className="btn sm" to={sp(`/books/${sel}`)}>صفحة الكتاب</Link>
      </div>
      <span className="small muted">
        {analysis.parent.get(sel) ? `أصله المستنتج: ${title(analysis.parent.get(sel)!.from)}` : 'لا يظهر له أصل في النصوص'}
        {` · رأس عائلته: ${title(analysis.rootOf(sel))}`}
      </span>
    </div>
  )
}

export function Compare() {
  const { issues, passages, bookById, analysis, thresholds } = useStore()
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
  const r = pa && pb && pa !== pb ? compare(tokenize(pa.body), tokenize(pb.body), thresholds) : null

  // البحث عن أقرب نص لنص يلصقه الباحث دون حفظه
  const freeTk = tokenize(free)
  const ranked = freeTk.length > 1
    ? passages.map(p => ({ p, c: compare(analysis.passages.get(p.id)?.tokens ?? tokenize(p.body), freeTk, thresholds) })).sort((x, y) => y.c.sim - x.c.sim).slice(0, 5)
    : []

  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>اختر أي نصين من هذا العلم، ويُعامل الأقدم منهما مصدراً.</p>
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
              <Link key={p.id} className="item" to={sp(`/issues/${p.issueId}#${p.id}`)}>
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
