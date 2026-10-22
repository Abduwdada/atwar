import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { db, deletePassage } from '../data/db'
import { useStore } from '../data/store'
import type { Passage } from '../data/types'
import { Badge, ConfirmButton, DiffText, PageHead, count, pct, yr } from '../ui/bits'
import { IssueForm } from '../ui/forms'
import * as Icon from '../ui/icons'

export function IssueList() {
  const { issues, passages } = useStore()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const nav = useNavigate()
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    passages.forEach(p => m.set(p.issueId, (m.get(p.issueId) ?? 0) + 1))
    return m
  }, [passages])
  const groups = useMemo(() => {
    const t = q.trim()
    const g = new Map<string, typeof issues>()
    issues.filter(i => !t || i.name.includes(t) || i.section?.includes(t))
      .forEach(i => g.set(i.section ?? 'بلا باب', [...(g.get(i.section ?? 'بلا باب') ?? []), i]))
    return [...g.entries()]
  }, [issues, q])

  return (
    <>
      <PageHead title="المسائل" sub={count(issues.length, 'مسألة', 'مسألتان', 'مسائل', 'مسألة')}
        action={<button className="btn sm" onClick={() => setAdding(a => !a)}><Icon.Plus />مسألة</button>} />
      {adding && <IssueForm onSaved={i => nav(`/issues/${i.id}`)} onCancel={() => setAdding(false)} />}
      <div className="search"><Icon.Search /><input id="issues-q" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث في المسائل" /></div>
      {groups.map(([section, list]) => (
        <div className="stack tight" key={section}>
          <div className="section-label">{section}</div>
          <div className="list">
            {list.map(i => (
              <Link key={i.id} className="item" to={`/issues/${i.id}`}>
                <div className="grow"><div className="title">{i.name}</div></div>
                <span className="end">{count(counts.get(i.id) ?? 0, 'نص', 'نصان', 'نصوص', 'نصاً')}</span>
                <Icon.ChevronIn />
              </Link>
            ))}
          </div>
        </div>
      ))}
      {!issues.length && !adding && <div className="empty card">لا توجد مسائل بعد. أضف أول مسألة أو مصطلح.</div>}
    </>
  )
}

export function IssuePage() {
  const { id = '' } = useParams()
  const { hash } = useLocation()
  const nav = useNavigate()
  const { issueById, passages, analysis } = useStore()
  const issue = issueById.get(id)
  const [editing, setEditing] = useState(false)
  const [showDel, setShowDel] = useState(true)

  const list = useMemo(() =>
    passages.filter(p => p.issueId === id)
      .map(p => analysis.passages.get(p.id)!)
      .filter(Boolean)
      .sort((a, b) => a.book.death - b.book.death || a.passage.createdAt - b.passage.createdAt),
  [passages, analysis, id])

  useEffect(() => {
    const el = hash && document.getElementById(hash.slice(1))
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.classList.add('flash')
    const t = setTimeout(() => el.classList.remove('flash'), 1600)
    return () => clearTimeout(t)
  }, [hash, list.length])

  if (!issue) return <div className="empty">هذه المسألة غير موجودة. <Link to="/issues">كل المسائل</Link></div>

  async function setSource(p: Passage, v: string) {
    const source = v === '' ? undefined : v === 'none' ? { mode: 'none' as const } : { mode: 'manual' as const, passageId: v }
    await db.passages.update(p.id, { source, confirmed: false, updatedAt: Date.now() })
  }

  async function removeIssue() {
    await db.transaction('rw', db.issues, db.passages, async () => {
      await db.passages.where({ issueId: id }).delete()
      await db.issues.delete(id)
    })
    nav('/issues')
  }

  return (
    <>
      <PageHead back="/issues" title={issue.name} sub={issue.section}
        action={<button className="icon-btn" onClick={() => setEditing(e => !e)} aria-label="تعديل المسألة"><Icon.Edit /></button>} />
      {editing && (
        <div className="stack tight">
          <IssueForm issue={issue} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
          <ConfirmButton label="حذف المسألة" confirm={`تُحذف معها ${count(list.length, 'نص', 'نصان', 'نصوص', 'نصاً')}. متأكد؟`} onConfirm={removeIssue} />
        </div>
      )}

      <div className="row" style={{ alignItems: 'center' }}>
        <Link className="btn primary" to={`/add?issue=${id}`} style={{ flex: '0 1 auto' }}><Icon.Plus />نص لهذه المسألة</Link>
        <label className="check small muted" style={{ flex: '0 1 auto' }}>
          <input id="show-del" type="checkbox" checked={showDel} onChange={e => setShowDel(e.target.checked)} />إظهار المحذوف من المصدر
        </label>
      </div>
      <div className="keys">
        <span><ins>زيادة</ins> على المصدر</span>
        <span><ins className="nv">لفظ جديد</ins> لم يرد قبله</span>
        <span><del>محذوف</del> من المصدر</span>
      </div>

      {list.length ? (
        <div className="timeline">
          {list.map(a => {
            const p = a.passage
            const place = [p.volume && `الجزء ${p.volume}`, p.page && `ص ${p.page}`, p.edition].filter(Boolean).join(' · ')
            const current = p.source?.mode === 'manual' ? p.source.passageId : p.source?.mode === 'none' ? 'none' : ''
            return (
              <article className="tcard" id={p.id} key={p.id}>
                <header>
                  <h3><Link to={`/books/${a.book.id}`}>{a.book.title}</Link></h3>
                  <span className="who">{a.book.author} · <span className="num">{yr(a.book)}</span>{a.book.school ? ` · ${a.book.school}` : ''}</span>
                </header>
                <div className="relline">
                  <Badge relation={a.relation} manual={a.manual} />
                  {a.source && <span><span className="num">{pct(a.source.cmp.sim)}</span> عن <b>{a.source.book.title}</b></span>}
                  {p.confirmed && <span className="badge mine"><Icon.Check />معتمد</span>}
                </div>
                <p className="text">
                  {p.lead && <span className="lead">{p.lead} </span>}
                  {a.source ? <DiffText ops={a.source.cmp.ops} novel={a.novel} showDel={showDel} /> : p.body}
                </p>
                {a.close && a.candidates[1] && <span className="warn">مرشحان متقاربان: {a.candidates[0].book.title} و{a.candidates[1].book.title}، وقد يرجعان إلى أصل مشترك</span>}
                {a.second && <span className="small muted">ويظهر فيه أثر <b>{a.second.book.title}</b> في: {a.second.words.join('، ')}</span>}
                <span className="small muted">{place || 'الموضع في الكتاب لم يُدخل بعد'}{p.note ? ` · ${p.note}` : ''}</span>
                <div className="tools">
                  {a.candidates.length > 0 && (
                    <select id={`src-${p.id}`} className="select" value={current} onChange={e => setSource(p, e.target.value)} aria-label="المصدر">
                      <option value="">المصدر: الأقرب تلقائياً</option>
                      {a.candidates.map(c => <option key={c.passage.id} value={c.passage.id}>{c.book.title} ({pct(c.cmp.sim)})</option>)}
                      <option value="none">لا مصدر له</option>
                    </select>
                  )}
                  {a.candidates.length > 0 && (
                    <button className="btn sm" onClick={() => db.passages.update(p.id, { confirmed: !p.confirmed })}>
                      {p.confirmed ? 'إلغاء الاعتماد' : 'اعتماد الصلة'}
                    </button>
                  )}
                  <Link className="btn sm ghost" to={`/passages/${p.id}/edit`}><Icon.Edit />تعديل</Link>
                  <ConfirmButton label="حذف" confirm="حذف هذا النص؟" onConfirm={() => deletePassage(p.id)} />
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty card">لا نصوص في هذه المسألة بعد.</div>
      )}
    </>
  )
}
