import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../data/db'
import * as Icon from '../ui/icons'
import { sp } from '../nav'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { tokenize } from '../engine/arabic'
import { compare } from '../engine/compare'
import { Badge, DiffText, ar, count, pct, yr } from '../ui/bits'
import PhaseBar from '../ui/PhaseBar'
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
type Drag =
  | { kind: 'node'; id: string; dx: number; dy: number; moved: boolean }
  | { kind: 'bend'; key: string; mid: Pt; moved: boolean }
  | { kind: 'pan'; x: number; y: number; left: number; top: number }

export function Tree() {
  const { books, links, analysis, passages, science, canEdit, issueById } = useStore()
  const [sel, setSel] = useState<string>('')
  const [o, set] = useListPrefs('tree', { view: 'v' as View, inf: true, dec: true })
  const [zoom, setZoom] = useState(1)
  const [bending, setBending] = useState(false)
  const [full, setFull] = useState(false)
  const [box, setBox] = useState({ w: 0, h: 0 })
  // ما يغيّره الزائر يبقى عنده مؤقتاً، وما يغيّره المؤلف يُحفظ مع العلم ويُنشر
  const [local, setLocal] = useState<Record<string, Pt>>({})
  const [localBends, setLocalBends] = useState<Record<string, Pt>>({})
  const [drag, setDrag] = useState<Drag | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fitted = useRef('')
  const withTexts = new Set(passages.map(p => p.bookId))
  const schools = [...new Set(books.map(b => b.school || 'غير محدد'))]
  const colorOf = (s?: string) => `var(--cat-${(schools.indexOf(s || 'غير محدد') % 6) + 1})`
  const view = o.view
  const V = view === 'v'
  const setView = (v: View) => { set('view', v); setLocal({}); setLocalBends({}); setSel(''); setBending(false) }

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
  const centuryLabel = (c: number) => `القرن ${ORD[c] ?? ar(c + 1)}`

  const stepT = V ? 64 : 150, stepB = V ? 150 : 86
  const gapT = V ? 58 : 140 // أدنى مسافة بين آخر كتاب في قرن وأول كتاب في الذي يليه
  const toXY = (t: number, b: number): Pt => (V ? { x: -b, y: t } : { x: -t, y: b })
  const tOf = (p: Pt) => (V ? p.y : -p.x)
  const withT = (p: Pt, t: number): Pt => (V ? { x: p.x, y: t } : { x: -t, y: p.y })
  const auto = (id: string) => toXY(row.get(id)! * stepT, col.get(id)! * stepB)
  const layoutKey = V ? 'treeLayout' : 'treeLayoutH'
  const bendKey = V ? 'treeBends' : 'treeBendsH'
  const saved = (science?.[layoutKey] ?? {}) as Record<string, Pt>
  const savedBends = (science?.[bendKey] ?? {}) as Record<string, Pt>
  const pos = new Map(books.map(b => [b.id, local[b.id] ?? saved[b.id] ?? auto(b.id)]))
  const bends = { ...savedBends, ...localBends }
  const customized = Object.keys(local).length + Object.keys(saved).length + Object.keys(bends).length > 0

  // نطاق كل قرن يمتد بين أول كتبه وآخرها، فيضيق إذا قُرّبت كتبه، والحد بين قرنين في منتصف الفراغ بينهما
  const cents = [...new Set(books.map(b => century(b.death)))].sort((a, b) => a - b)
  const ext = new Map(cents.map(c => {
    const ts = books.filter(b => century(b.death) === c).map(b => tOf(pos.get(b.id)!))
    return [c, [Math.min(...ts), Math.max(...ts)] as [number, number]]
  }))
  const bands = cents.map((c, i) => {
    const [lo, hi] = ext.get(c)!
    const a = i === 0 ? lo - stepT / 2 : (ext.get(cents[i - 1])![1] + lo) / 2
    const b = i === cents.length - 1 ? hi + stepT / 2 : (hi + ext.get(cents[i + 1])![0]) / 2
    return { c, a, b }
  })
  const clampT = (id: string, t: number) => {
    const i = cents.indexOf(century(books.find(x => x.id === id)!.death))
    const min = i > 0 ? ext.get(cents[i - 1])![1] + gapT : -Infinity
    const max = i < cents.length - 1 ? ext.get(cents[i + 1])![0] - gapT : Infinity
    return Math.min(max, Math.max(min, t))
  }

  const pts = [...pos.values()]
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  const bandT = bands.flatMap(b => [b.a, b.b])
  const minX = V ? Math.min(...xs) - 200 : Math.min(...xs, -Math.max(...bandT)) - 60
  const maxX = V ? Math.max(...xs) + 120 : Math.max(...xs, -Math.min(...bandT)) + 60
  const minY = V ? Math.min(...ys, ...bandT) - 6 : Math.min(...ys) - 60
  const maxY = V ? Math.max(...ys, ...bandT) + 6 : Math.max(...ys) + 56
  const W = maxX - minX, H = maxY - minY

  // حجم الإطار يتابَع دائماً، ليملأ الرسم عرضه وارتفاعه مهما كبّره المستخدم أو صغّره
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [view, full, books.length])
  useEffect(() => {
    if (!full) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [full])
  const clampZ = (z: number) => Math.max(0.25, Math.min(1.25, z))
  const fitWidth = () => { const el = wrapRef.current; if (el) setZoom(clampZ((el.clientWidth - 4) / W)) }
  const fitAll = () => { const el = wrapRef.current; if (el) setZoom(clampZ(Math.min((el.clientWidth - 4) / W, (el.clientHeight - 4) / H))) }
  // أول عرض: العمودي يملأ العرض ويُمرَّر طولاً، والأفقي وملء الشاشة يُظهران الرسم كله
  useEffect(() => {
    const k = `${view}:${books.length}:${full}`
    if (view !== 'list' && fitted.current !== k) { fitted.current = k; if (V && !full) fitWidth(); else fitAll() }
  })
  const step = (f: number) => setZoom(z => Math.max(0.25, Math.min(2.5, +(z * f).toFixed(2))))

  if (!books.length) return <div className="empty card">أضف كتباً ونصوصاً لتظهر الشجرة.</div>

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

  // السهم: منحنى افتراضي، أو منحنى يمر بنقطة الوسط التي حرّكها المستخدم
  const ends = (a: Pt, b: Pt, toward?: Pt) => {
    const dirTo = (p: Pt, q: Pt) => { const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1; return { x: p.x + dx / l * 11, y: p.y + dy / l * 11 } }
    return toward ? [dirTo(a, toward), dirTo(b, toward)] : null
  }
  const midOf = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const edgePath = (key: string, a: Pt, b: Pt, bend: number) => {
    const off = bends[key]
    if (off) {
      const hp = { x: midOf(a, b).x + off.x, y: midOf(a, b).y + off.y }
      const [s, e] = ends(a, b, hp)!
      const c = { x: 2 * hp.x - (s.x + e.x) / 2, y: 2 * hp.y - (s.y + e.y) / 2 }
      return { d: `M${s.x},${s.y} Q${c.x},${c.y} ${e.x},${e.y}`, handle: hp }
    }
    if (V) {
      const down = b.y >= a.y, y1 = a.y + (down ? 11 : -11), y2 = b.y + (down ? -11 : 11), dd = (y2 - y1) / 2
      return { d: `M${a.x},${y1} C${a.x + bend},${y1 + dd} ${b.x + bend},${y2 - dd} ${b.x},${y2}`, handle: { x: midOf(a, b).x + bend * 0.75, y: midOf(a, b).y } }
    }
    const left = b.x <= a.x, x1 = a.x + (left ? -11 : 11), x2 = b.x + (left ? 11 : -11), dd = (x2 - x1) / 2
    return { d: `M${x1},${a.y} C${x1 + dd},${a.y + bend} ${x2 - dd},${b.y + bend} ${x2},${b.y}`, handle: { x: midOf(a, b).x, y: midOf(a, b).y + bend * 0.75 } }
  }
  const edges = [
    ...(o.dec ? links.filter(l => pos.has(l.from) && pos.has(l.to)).map(l => ({ key: 'l:' + l.id, from: l.from, to: l.to, declared: true, weight: 0, tip: `${title(l.from)} ← ${title(l.to)}${l.note ? ': ' + l.note : ''}` })) : []),
    ...(o.inf ? analysis.edges.map(e => ({ key: e.from + '>' + e.to, from: e.from, to: e.to, declared: false, weight: e.weight, tip: `${title(e.from)} ← ${title(e.to)}: ${e.items.map(i => pct(i.sim)).join('، ')}` })) : []),
  ]

  const toSvg = (e: React.PointerEvent): Pt => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svgRef.current!.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }
  function startNode(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toSvg(e), cur = pos.get(id)!
    setDrag({ kind: 'node', id, dx: p.x - cur.x, dy: p.y - cur.y, moved: false })
  }
  function startBend(e: React.PointerEvent, key: string, a: Pt, b: Pt) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ kind: 'bend', key, mid: midOf(a, b), moved: false })
  }
  function startPan(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse' || !wrapRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ kind: 'pan', x: e.clientX, y: e.clientY, left: wrapRef.current.scrollLeft, top: wrapRef.current.scrollTop })
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return
    if (drag.kind === 'pan') {
      const w = wrapRef.current!
      w.scrollLeft = drag.left - (e.clientX - drag.x)
      w.scrollTop = drag.top - (e.clientY - drag.y)
      return
    }
    const p = toSvg(e)
    if (drag.kind === 'bend') {
      setDrag({ ...drag, moved: true })
      setLocalBends(l => ({ ...l, [drag.key]: { x: Math.round(p.x - drag.mid.x), y: Math.round(p.y - drag.mid.y) } }))
      return
    }
    const raw = { x: Math.round(p.x - drag.dx), y: Math.round(p.y - drag.dy) }
    const next = withT(raw, clampT(drag.id, tOf(raw)))
    const cur = pos.get(drag.id)!
    if (!drag.moved && Math.hypot(next.x - cur.x, next.y - cur.y) < 4) return
    setDrag({ ...drag, moved: true })
    setLocal(l => ({ ...l, [drag.id]: next }))
  }
  async function onUp() {
    const d = drag
    setDrag(null)
    if (!d || d.kind === 'pan') return
    if (d.kind === 'node' && !d.moved) return setSel(d.id)
    if (!canEdit || !science || !d.moved) return
    if (d.kind === 'node') {
      await db.sciences.update(science.id, { [layoutKey]: { ...saved, [d.id]: local[d.id] } })
      setLocal(l => { const r = { ...l }; delete r[d.id]; return r })
    } else {
      await db.sciences.update(science.id, { [bendKey]: { ...savedBends, [d.key]: localBends[d.key] } })
      setLocalBends(l => { const r = { ...l }; delete r[d.key]; return r })
    }
  }
  async function straighten(key: string) {
    setLocalBends(l => { const r = { ...l }; delete r[key]; return r })
    if (canEdit && science && savedBends[key]) {
      const r = { ...savedBends }
      delete r[key]
      await db.sciences.update(science.id, { [bendKey]: r })
    }
  }
  // ضغط الفراغات: يقرّب كل قرن من الذي قبله إلى أدنى مسافة، مع حفظ ترتيب كتبه داخله
  async function compact() {
    const next: Record<string, Pt> = {}
    let prevMax = -Infinity
    for (const c of cents) {
      const [lo, hi] = ext.get(c)!
      const shift = prevMax === -Infinity ? 0 : prevMax + gapT - lo
      books.filter(b => century(b.death) === c).forEach(b => { const p = pos.get(b.id)!; next[b.id] = withT(p, tOf(p) + shift) })
      prevMax = hi + shift
    }
    if (canEdit && science) { setLocal({}); await db.sciences.update(science.id, { [layoutKey]: next }) }
    else setLocal(next)
  }
  async function resetLayout() {
    setLocal({}); setLocalBends({})
    if (canEdit && science) await db.sciences.update(science.id, { [layoutKey]: undefined, [bendKey]: undefined })
  }

  // الرسم يتسع ليملأ الإطار، والمحتوى في وسطه، فلا يبقى جزء من الإطار فارغاً بلا ظلال القرون
  const viewW = Math.max(W, (box.w - 2) / zoom), viewH = Math.max(H, (box.h - 2) / zoom)
  const vx = minX - (viewW - W) / 2

  return (
    <>
      <div className={'tree-stage' + (full ? ' full' : '')}>
      <div className="controls">
        {viewSwitch}
        <span className="zoom-btns">
          <button className="icon-btn" onClick={() => step(1 / 1.2)} aria-label="تصغير"><Icon.Minus /></button>
          <span className="num small">{ar(Math.round(zoom * 100))}٪</span>
          <button className="icon-btn" onClick={() => step(1.2)} aria-label="تكبير"><Icon.Plus /></button>
          <button className="btn sm" onClick={fitWidth}>ملء العرض</button>
          <button className="btn sm" onClick={fitAll}>إظهار الكل</button>
        </span>
        <button className="btn sm" onClick={() => setFull(f => !f)}>{full ? 'إغلاق ملء الشاشة' : 'ملء الشاشة'}</button>
        <button className={'btn sm' + (bending ? ' primary' : '')} onClick={() => setBending(b => !b)}>{bending ? 'تم' : 'ثني الأسهم'}</button>
        <button className="btn sm" onClick={compact}>ضغط الفراغات</button>
        {customized && <button className="btn sm ghost" onClick={resetLayout}>الترتيب التلقائي</button>}
      </div>
      <div className="legend">
        <label className="check"><input id="tg-inf" type="checkbox" checked={o.inf} onChange={e => set('inf', e.target.checked)} /><span className="swl" />مستنتجة من النصوص</label>
        <label className="check"><input id="tg-dec" type="checkbox" checked={o.dec} onChange={e => set('dec', e.target.checked)} /><span className="swl dash" />معلنة</label>
        {schools.map(s => <span key={s}><i className="sw-dot" style={{ background: colorOf(s) }} />{s}</span>)}
        <span><i className="sw-dot hollow-dot" />كتاب لم تُضف نصوصه بعد</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {bending ? 'اسحب النقطة في وسط أي سهم لثنيه، واضغطها مرتين لإرجاعه مستقيماً.' : 'اسحب أي كتاب لتحريكه داخل قرنه، واسحب الفراغ لتحريك الرسم.'}
        {canEdit ? ' ما ترتبه يُحفظ ويُنشر للزوار.' : ''}
      </p>
      <div className={'svgwrap tree-wrap' + (drag?.kind === 'pan' ? ' panning' : '')} ref={wrapRef}>
        <svg ref={svgRef} viewBox={`${vx} ${minY} ${viewW} ${viewH}`} style={{ width: viewW * zoom, minWidth: 0, height: viewH * zoom }}
          role="img" aria-label={V ? 'شجرة الكتب، الأقدم في الأعلى' : 'شجرة الكتب، الأقدم على اليمين'}
          onPointerDown={startPan} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
          <defs>
            <marker id="arA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" /></marker>
            <marker id="arG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--gold)" /></marker>
          </defs>
          {bands.map(({ c, a, b }, i) => V ? (
            <g key={c}>
              {i % 2 === 1 && <rect x={vx} y={a} width={viewW} height={b - a} fill="var(--sunken)" opacity="0.6" />}
              <text x={vx + viewW - 12} y={a + 20} textAnchor="end" fontSize="12.5" fontWeight="600" fill="var(--muted)" fontFamily="var(--f-ui)">{centuryLabel(c)}</text>
            </g>
          ) : (
            <g key={c}>
              {i % 2 === 1 && <rect x={-b} y={minY} width={b - a} height={viewH} fill="var(--sunken)" opacity="0.6" />}
              <text x={-a - 8} y={minY + 22} textAnchor="end" fontSize="12.5" fontWeight="600" fill="var(--muted)" fontFamily="var(--f-ui)">{centuryLabel(c)}</text>
            </g>
          ))}
          {edges.map(e => {
            const a = pos.get(e.from)!, b = pos.get(e.to)!
            const { d } = edgePath(e.key, a, b, e.declared ? 16 : 0)
            const isP = !e.declared && analysis.parent.get(e.to)?.from === e.from
            return e.declared
              ? <path key={e.key} d={d} fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#arG)"><title>{e.tip}</title></path>
              : <path key={e.key} d={d} fill="none" stroke="var(--accent)" strokeOpacity={isP ? 0.95 : 0.4} strokeWidth={(isP ? 1.6 : 1) + Math.min(e.weight, 2) * 1.4} markerEnd="url(#arA)"><title>{e.tip}</title></path>
          })}
          {books.map(b => {
            const p = pos.get(b.id)!
            const has = withTexts.has(b.id)
            const w = b.title.length * 9 + 30
            return (
              <g key={b.id} className={'node draggable' + (sel === b.id ? ' sel' : '') + (drag?.kind === 'node' && drag.id === b.id ? ' grabbing' : '')} tabIndex={0} role="button" aria-label={b.title}
                onPointerDown={e => startNode(e, b.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSel(b.id)}>
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
          {bending && edges.map(e => {
            const a = pos.get(e.from)!, b = pos.get(e.to)!
            const { handle } = edgePath(e.key, a, b, e.declared ? 16 : 0)
            return (
              <circle key={'h' + e.key} className="bend-handle" cx={handle.x} cy={handle.y} r="7" fill="var(--surface)" stroke={e.declared ? 'var(--gold)' : 'var(--accent)'} strokeWidth="2"
                onPointerDown={ev => startBend(ev, e.key, a, b)} onDoubleClick={() => straighten(e.key)}><title>{e.tip}</title></circle>
            )
          })}
        </svg>
      </div>
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

// مناهج التأليف عبر القرون: متى ظهر كل منهج، ومتى غلب على التصنيف
export function Methods() {
  const { books, lists, science } = useStore()
  const [cell, setCell] = useState<{ m: string; c: number } | null>(null)
  const used = lists.methods.filter(m => books.some(b => b.method === m))
  const noMethod = books.filter(b => !b.method).length
  const cents = [...new Set(books.map(b => Math.floor(b.death / 100)))].sort((a, b) => a - b)
  const inCell = (m: string, c: number) => books.filter(b => b.method === m && Math.floor(b.death / 100) === c)
  const max = Math.max(1, ...used.flatMap(m => cents.map(c => inCell(m, c).length)))
  if (!used.length) return <div className="empty card">لم تُحدَّد طريقة التأليف لأي كتاب بعد. حدّدها في نموذج الكتاب، وأضف المناهج من «إعدادات العلم».</div>
  const sel = cell ? inCell(cell.m, cell.c).sort((a, b) => a.death - b.death) : []
  return (
    <>
      {science?.phases?.length ? <PhaseBar phases={science.phases} books={books} compact /> : null}
      <p className="small muted" style={{ margin: 0 }}>المناهج صفوفاً والقرون أعمدة، ولون الخانة بعدد الكتب. اضغط خانة لترى كتبها.{noMethod ? ` ${count(noMethod, 'كتاب', 'كتابان', 'كتب', 'كتاباً')} بلا منهج محدد.` : ''}</p>
      <div className="scroller">
        <table className="matrix methods">
          <thead><tr><th className="corner">المنهج</th>{cents.map(c => <th key={c}>القرن {ORD[c] ?? ar(c + 1)}<small>{ar(c * 100)}–{ar(c * 100 + 100)}هـ</small></th>)}</tr></thead>
          <tbody>
            {used.map(m => {
              const first = books.filter(b => b.method === m).sort((a, b) => a.death - b.death)[0]
              return (
                <tr key={m}>
                  <th className="rowh" scope="row">{m}<small>أول ظهور: {first.title} ({ar(first.death)}هـ)</small></th>
                  {cents.map(c => {
                    const n = inCell(m, c).length
                    const on = cell?.m === m && cell.c === c
                    return (
                      <td key={c} className="blank">
                        {n ? <button className={'heat-cell' + (on ? ' on' : '')} style={{ ['--fill' as string]: `${Math.round(15 + 70 * n / max)}%` }} onClick={() => setCell(on ? null : { m, c })}>{ar(n)}</button> : '·'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {cell && (
        <div className="stack tight">
          <div className="section-label">{cell.m} في القرن {ORD[cell.c] ?? ar(cell.c + 1)}</div>
          <div className="list">
            {sel.map(b => (
              <Link key={b.id} className="item" to={sp(`/books/${b.id}`)}>
                <span className="num muted year-col">{ar(b.death)}هـ</span>
                <div className="grow"><div className="title">{b.title}</div><div className="meta">{b.author}</div></div>
                <Icon.ChevronIn />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
