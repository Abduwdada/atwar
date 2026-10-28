import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { useListPrefs } from '../data/prefs'
import { XLINK_TYPES, type Book, type XLinkType } from '../data/types'
import { phaseOf } from '../engine/phases'
import { PageHead, ar } from '../ui/bits'
import * as Icon from '../ui/icons'

// خارطة التطور: مسارات متوازية للعلوم المختارة على محور زمني واحد، بمراحلها والصلات بينها
type LinkKind = XLinkType | 'author'
const KIND_LABEL: Record<LinkKind, string> = { author: 'المؤلف نفسه', ...XLINK_TYPES }
const KIND_COLOR: Record<LinkKind, string> = {
  author: 'var(--gold)', method: 'var(--accent)', term: 'var(--cat-1)', school: 'var(--cat-3)', critique: 'var(--rubric)', other: 'var(--muted)',
}
const LANE_COLORS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-6)', 'var(--cat-5)', 'var(--cat-3)', 'var(--cat-4)']
const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر']

interface MapLink { key: string; from: Book; to: Book; kind: LinkKind; note: string }

export default function EvolutionMap() {
  const { sciences, groups, allBooks, xlinks, authorById } = useStore()
  const [o, set] = useListPrefs('map', { sel: [] as string[], phases: true, hidden: [] as LinkKind[] })
  const [focus, setFocus] = useState<{ book?: string; author?: string }>({})
  const [zoom, setZoom] = useState(1)
  const wrapRef = useRef<HTMLDivElement>(null)

  // العلوم المختارة؛ وإن لم يُختر شيء فكل العلوم المنشورة
  const chosen = sciences.filter(s => (o.sel.length ? o.sel.includes(s.id) : true))
  const chosenIds = new Set(chosen.map(s => s.id))
  const books = useMemo(() => allBooks.filter(b => chosenIds.has(b.scienceId)).sort((a, b) => a.death - b.death), [allBooks, chosen.map(s => s.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const bookById = new Map(books.map(b => [b.id, b]))

  // الصلات: المسجلة بين العلوم، وما يجمعه مؤلف واحد في علمين
  const links: MapLink[] = useMemo(() => {
    const out: MapLink[] = []
    xlinks.forEach(x => {
      const a = bookById.get(x.from), b = bookById.get(x.to)
      if (a && b && a.scienceId !== b.scienceId) out.push({ key: x.id, from: a, to: b, kind: x.type, note: x.note })
    })
    const byAuthor = new Map<string, Book[]>()
    books.forEach(b => { if (b.authorId) byAuthor.set(b.authorId, [...(byAuthor.get(b.authorId) ?? []), b]) })
    byAuthor.forEach((list, aid) => {
      const firstPerSci = new Map<string, Book>()
      list.forEach(b => { if (!firstPerSci.has(b.scienceId)) firstPerSci.set(b.scienceId, b) })
      const reps = [...firstPerSci.values()]
      for (let i = 1; i < reps.length; i++)
        out.push({ key: `a:${aid}:${i}`, from: reps[i - 1], to: reps[i], kind: 'author', note: `${authorById.get(aid)?.name ?? ''} صنّف في العلمين` })
    })
    return out
  }, [books, xlinks, authorById]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = links.filter(l => !o.hidden.includes(l.kind))
  const bridges = [...new Set(links.filter(l => l.kind === 'author').map(l => l.from.authorId!))].map(id => authorById.get(id)).filter(Boolean)

  // الهندسة: الزمن يجري من اليمين إلى اليسار، ولكل علم مسار بطبقات تمنع تزاحم الأسماء
  const geo = useMemo(() => {
    if (!books.length) return null
    const Y0 = Math.floor(books[0].death / 100) * 100
    const Y1 = Math.ceil((books.at(-1)!.death + 1) / 100) * 100
    // القرون التي لا كتب فيها تُطوى، فلا يتسع الرسم بلا فائدة
    const cents = [...new Set(books.map(b => Math.floor(b.death / 100)))].sort((a, b) => a - b)
    const colW = 150, RIGHT = 150, LEFT = 140, TOP = 34
    const W = RIGHT + cents.length * colW + LEFT
    const at = (y: number) => {
      const c = Math.floor(y / 100), i = cents.indexOf(c)
      return i >= 0 ? i + (y - c * 100) / 100 : cents.filter(x => x < c).length
    }
    const X = (y: number) => W - RIGHT - at(y) * colW
    const pos = new Map<string, { x: number; y: number }>()
    const lanes: { id: string; top: number; h: number }[] = []
    let top = TOP
    chosen.forEach(s => {
      const list = books.filter(b => b.scienceId === s.id)
      const tiers: number[] = []
      const tierOf = new Map<string, number>()
      list.forEach(b => {
        const x = X(b.death), w = b.title.length * 8 + 22
        let t = tiers.findIndex(left => x + 10 < left)
        if (t < 0) { t = tiers.length; tiers.push(Infinity) }
        tiers[t] = x - w
        tierOf.set(b.id, t)
      })
      const n = Math.max(1, tiers.length)
      const h = 44 + n * 30
      list.forEach(b => pos.set(b.id, { x: X(b.death), y: top + 34 + tierOf.get(b.id)! * 30 }))
      lanes.push({ id: s.id, top, h })
      top += h + 10
    })
    return { Y0, Y1, W, H: top + 6, X, pos, lanes, RIGHT, TOP, cents }
  }, [books, chosen.map(s => s.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => { const w = wrapRef.current?.clientWidth; if (w && geo) setZoom(Math.max(0.35, Math.min(1.2, (w - 4) / geo.W))) }
  useEffect(fit, [geo?.W]) // eslint-disable-line react-hooks/exhaustive-deps

  const isOn = (b: Book) => {
    if (focus.author) return b.authorId === focus.author
    if (focus.book) return b.id === focus.book || shown.some(l => (l.from.id === focus.book && l.to.id === b.id) || (l.to.id === focus.book && l.from.id === b.id))
    return true
  }
  const toggleSci = (id: string) => {
    const base = o.sel.length ? o.sel : sciences.map(s => s.id)
    set('sel', base.includes(id) ? base.filter(x => x !== id) : [...base, id])
    setFocus({})
  }
  const sciName = new Map(sciences.map(s => [s.id, s.name]))
  const sciOf = new Map(sciences.map(s => [s.id, s]))
  const laneColor = (id: string) => LANE_COLORS[chosen.findIndex(s => s.id === id) % LANE_COLORS.length]

  // لحظات الالتقاء: كل صلة بزمن الكتاب المتأخر، ومرحلة كل علم حينئذ
  const meetings = shown.filter(l => l.kind !== 'author').map(l => ({ l, year: l.to.death })).sort((a, b) => a.year - b.year)
  const sel = focus.book ? bookById.get(focus.book) : undefined

  return (
    <>
      <PageHead title="خارطة التطور" sub="العلوم المختارة على محور زمني واحد، بمراحلها والصلات بينها" />

      <div className="controls">
        <span className="ctl-label">العلوم:</span>
        {groups.map(g => {
          const ids = sciences.filter(s => s.groupId === g.id).map(s => s.id)
          if (!ids.length) return null
          const on = ids.length === chosen.length && ids.every(id => chosenIds.has(id))
          return <button key={g.id} className="chip" aria-pressed={on} onClick={() => { set('sel', ids); setFocus({}) }}>{g.name}</button>
        })}
        {sciences.map(s => <button key={s.id} className="chip" aria-pressed={chosenIds.has(s.id)} onClick={() => toggleSci(s.id)}>{s.name}</button>)}
        {o.sel.length > 0 && <button className="btn sm ghost" onClick={() => set('sel', [])}>كل العلوم</button>}
      </div>

      {!geo || chosen.length === 0 ? (
        <div className="empty card">اختر علماً أو أكثر فيه كتب بسنوات وفاة مؤلفيها.</div>
      ) : (
        <>
          <div className="controls">
            <span className="ctl-label">الصلات:</span>
            {(Object.keys(KIND_LABEL) as LinkKind[]).filter(k => links.some(l => l.kind === k)).map(k => (
              <button key={k} className="chip" aria-pressed={!o.hidden.includes(k)} onClick={() => set('hidden', o.hidden.includes(k) ? o.hidden.filter(x => x !== k) : [...o.hidden, k])}>
                <i className={'swl-chip' + (k === 'author' ? ' dash' : '')} style={{ color: KIND_COLOR[k] }} />{KIND_LABEL[k]}
              </button>
            ))}
            {!links.length && <span className="small muted">لا صلات بين هذه العلوم بعد. أضفها من صفحة أي كتاب، أو بإضافة كتب لمؤلف واحد في علمين.</span>}
            <label className="check ctl-check"><input id="map-phases" type="checkbox" checked={o.phases} onChange={e => set('phases', e.target.checked)} />مراحل كل علم</label>
            <span className="zoom-btns">
              <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.35, +(z / 1.2).toFixed(2)))} aria-label="تصغير"><Icon.Minus /></button>
              <button className="icon-btn" onClick={() => setZoom(z => Math.min(2.5, +(z * 1.2).toFixed(2)))} aria-label="تكبير"><Icon.Plus /></button>
              <button className="btn sm" onClick={fit}>ملاءمة</button>
            </span>
          </div>

          {bridges.length > 0 && (
            <div className="controls">
              <span className="ctl-label">علماء جسور:</span>
              {bridges.map(a => (
                <button key={a!.id} className="chip" aria-pressed={focus.author === a!.id} onClick={() => setFocus(f => (f.author === a!.id ? {} : { author: a!.id }))}>{a!.name}</button>
              ))}
            </div>
          )}

          <div className="svgwrap map-wrap" ref={wrapRef}>
            <svg viewBox={`0 0 ${geo.W} ${geo.H}`} style={{ width: geo.W * zoom, height: geo.H * zoom, minWidth: 0 }} role="img" aria-label="خارطة تطور العلوم المختارة">
              {geo.cents.map((c, i) => (
                <g key={c}>
                  <line x1={geo.X(c * 100)} y1={geo.TOP - 10} x2={geo.X(c * 100)} y2={geo.H} stroke="var(--line)" strokeDasharray={i > 0 && geo.cents[i - 1] !== c - 1 ? '3 4' : undefined} />
                  <text x={geo.X(c * 100 + 50)} y={geo.TOP - 14} textAnchor="middle" fontSize="12" fill="var(--muted)" fontFamily="var(--f-ui)">القرن {ORD[c] ?? ar(c + 1)}</text>
                </g>
              ))}
              {geo.lanes.map(l => {
                const s = sciOf.get(l.id)!
                const color = laneColor(l.id)
                return (
                  <g key={l.id}>
                    <rect x={8} y={l.top} width={geo.W - 16} height={l.h} rx="10" fill="var(--paper)" opacity="0.6" />
                    {o.phases && (s.phases ?? []).map((p, i) => {
                      const x1 = Math.max(8, geo.X(Math.min(p.to, geo.Y1))), x2 = Math.min(geo.W - geo.RIGHT, geo.X(Math.max(p.from, geo.Y0)))
                      if (x2 <= x1) return null
                      return (
                        <g key={i}>
                          <rect x={x1} y={l.top + 2} width={x2 - x1} height={l.h - 4} fill={color} opacity={i % 2 ? 0.07 : 0.14} rx="6" />
                          <text x={x2 - 6} y={l.top + l.h - 8} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--f-ui)">{p.name}</text>
                        </g>
                      )
                    })}
                    <text x={geo.W - 14} y={l.top + l.h / 2 + 6} textAnchor="end" fontSize="20" fontWeight="700" fill={color} fontFamily="var(--f-brand)">{s.name}</text>
                  </g>
                )
              })}
              {shown.map(lk => {
                const a = geo.pos.get(lk.from.id)!, b = geo.pos.get(lk.to.id)!
                const on = isOn(lk.from) && isOn(lk.to)
                const mx = (a.x + b.x) / 2 + (b.y > a.y ? 24 : -24), my = (a.y + b.y) / 2
                return (
                  <path key={lk.key} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} fill="none" stroke={KIND_COLOR[lk.kind]} strokeWidth="2.2"
                    strokeDasharray={lk.kind === 'author' ? '6 4' : undefined} className={on ? '' : 'dim'}>
                    <title>{`${KIND_LABEL[lk.kind]}: ${lk.from.title} ← ${lk.to.title}${lk.note ? ' · ' + lk.note : ''}`}</title>
                  </path>
                )
              })}
              {books.map(b => {
                const p = geo.pos.get(b.id)!
                return (
                  <g key={b.id} className={'node' + (focus.book === b.id ? ' sel' : '') + (isOn(b) ? '' : ' dim')} tabIndex={0} role="button" aria-label={`${b.title}، ${b.author}`}
                    onClick={() => setFocus(f => (f.book === b.id ? {} : { book: b.id }))} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFocus({ book: b.id })}>
                    <circle cx={p.x} cy={p.y} r="7" fill={laneColor(b.scienceId)} />
                    <text x={p.x - 11} y={p.y + 5} textAnchor="end" fontSize="14" fontWeight="700" fill="var(--ink)" fontFamily="var(--f-text)">{b.title}</text>
                    <title>{`${b.title} · ${b.author} · ${ar(b.death)}هـ`}</title>
                  </g>
                )
              })}
            </svg>
          </div>

          {sel && (
            <div className="card">
              <div className="page-head" style={{ minHeight: 0 }}>
                <strong style={{ fontFamily: 'var(--f-text)', fontSize: 22 }}>{sel.title}</strong>
                <Link className="btn sm" to={`/s/${sel.scienceId}/books/${sel.id}`}>صفحة الكتاب</Link>
              </div>
              <span className="small muted">
                {sel.authorId ? <Link to={`/authors/${sel.authorId}`}>{sel.author}</Link> : sel.author} · ت {ar(sel.death)}هـ · {sciName.get(sel.scienceId)}
                {phaseOf(sciOf.get(sel.scienceId)?.phases, sel.death) && ` · في مرحلة ${phaseOf(sciOf.get(sel.scienceId)?.phases, sel.death)!.name}`}
              </span>
              {shown.filter(l => l.from.id === sel.id || l.to.id === sel.id).map(l => {
                const other = l.from.id === sel.id ? l.to : l.from
                return <span key={l.key} className="small"><b>{KIND_LABEL[l.kind]}:</b> {other.title} ({sciName.get(other.scienceId)}){l.note ? ` · ${l.note}` : ''}</span>
              })}
            </div>
          )}

          <section className="stack tight">
            <div className="section-head"><h2>لحظات الالتقاء بين العلوم</h2></div>
            {meetings.length ? (
              <div className="list">
                {meetings.map(({ l, year }) => {
                  const pf = phaseOf(sciOf.get(l.from.scienceId)?.phases, l.from.death)
                  const pt = phaseOf(sciOf.get(l.to.scienceId)?.phases, l.to.death)
                  return (
                    <div className="item" key={l.key} style={{ cursor: 'default' }}>
                      <span className="num muted year-col">{ar(year)}هـ</span>
                      <div className="grow">
                        <div className="title">
                          <span className="badge s2">{KIND_LABEL[l.kind]}</span>{' '}
                          {sciName.get(l.to.scienceId)} <span className="muted small">({l.to.title})</span> أخذ من {sciName.get(l.from.scienceId)} <span className="muted small">({l.from.title})</span>
                        </div>
                        <div className="meta">{[pt && `${sciName.get(l.to.scienceId)} في مرحلة ${pt.name}`, pf && `${sciName.get(l.from.scienceId)} في مرحلة ${pf.name}`, l.note].filter(Boolean).join(' · ')}</div>
                        {l.from.death > l.to.death && <div className="warn small">تنبيه: الكتاب المأخوذ عنه متأخر عن الآخذ، فراجع اتجاه الصلة.</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="small muted" style={{ margin: '0 4px' }}>تظهر هنا الصلات المسجلة بين العلوم بترتيبها الزمني، مع مرحلة كل علم وقتها، فيتبين متى احتاج كل علم إلى الآخر.</p>}
          </section>
        </>
      )}
    </>
  )
}
