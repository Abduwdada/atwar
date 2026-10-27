import { useMemo, useState, type ReactNode } from 'react'
import { sp } from '../nav'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { db, newId } from '../data/db'
import { useStore } from '../data/store'
import type { Passage } from '../data/types'
import { splitLead } from '../engine/arabic'
import { Badge, DiffText, pct, yr } from '../ui/bits'
import { BookForm, IssueForm } from '../ui/forms'
import * as Icon from '../ui/icons'
import ImageToText from '../ui/ImageToText'

type Step = 'text' | 'book' | 'issue' | 'place' | 'done'
const ORDER: Step[] = ['text', 'book', 'issue', 'place']

export default function Add() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { science, books, issues, bookById, issueById, analysis, passages } = useStore()

  const [step, setStep] = useState<Step>('text')
  const [raw, setRaw] = useState('')
  const [lead, setLead] = useState('')
  const [leadTouched, setLeadTouched] = useState(false)
  const [bookId, setBookId] = useState(params.get('book') ?? '')
  const [issueId, setIssueId] = useState(params.get('issue') ?? '')
  const [volume, setVolume] = useState('')
  const [page, setPage] = useState('')
  const [edition, setEdition] = useState('')
  const [note, setNote] = useState('')
  const [savedId, setSavedId] = useState('')
  const [error, setError] = useState('')

  const book = bookById.get(bookId)
  const issue = issueById.get(issueId)
  // اللفظ المعرَّف يُقترح تلقائياً ما لم يعدّله الباحث
  const autoLead = splitLead(raw)
  const effLead = leadTouched ? lead : autoLead.lead
  const body = leadTouched && lead && raw.trim().startsWith(lead) ? raw.trim().slice(lead.length).trim() : leadTouched ? raw.trim() : autoLead.body

  const duplicate = book && issue && passages.find(p => p.bookId === book.id && p.issueId === issue.id)

  function next(from: Step) {
    const i = ORDER.indexOf(from)
    for (const s of ORDER.slice(i + 1)) {
      if (s === 'book' && bookById.has(bookId)) continue
      if (s === 'issue' && issueById.has(issueId)) continue
      return setStep(s)
    }
    setStep('place')
  }

  async function save() {
    if (!body) return setError('النص فارغ.')
    const now = Date.now()
    const p: Passage = {
      id: newId(), scienceId: science!.id, issueId, bookId, lead: effLead, body,
      volume: volume.trim() || undefined, page: page.trim() || undefined,
      edition: edition.trim() || undefined, note: note.trim() || undefined,
      createdAt: now, updatedAt: now,
    }
    await db.passages.add(p)
    setSavedId(p.id)
    setStep('done')
  }

  const stepNo = step === 'done' ? 4 : ORDER.indexOf(step)

  return (
    <>
      <div className="page-head">
        <h1>إضافة نص</h1>
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="إغلاق"><Icon.X /></button>
      </div>
      <div className="steps" aria-hidden="true">{ORDER.map((s, i) => <i key={s} className={i <= stepNo ? 'on' : ''} />)}</div>

      {step !== 'text' && step !== 'done' && (
        <div className="list">
          <button className="item" onClick={() => setStep('text')}>
            <div className="grow"><div className="meta">النص</div><div className="title" style={{ fontFamily: 'var(--f-text)', fontWeight: 400, fontSize: 18 }}>{body.split(/\s+/).slice(0, 8).join(' ')}…</div></div>
            <span className="end">تغيير</span>
          </button>
          {book && step !== 'book' && (
            <button className="item" onClick={() => setStep('book')}>
              <div className="grow"><div className="meta">الكتاب</div><div className="title">{book.title} <span className="muted small">{yr(book)}</span></div></div>
              <span className="end">تغيير</span>
            </button>
          )}
          {issue && step !== 'issue' && (
            <button className="item" onClick={() => setStep('issue')}>
              <div className="grow"><div className="meta">المسألة</div><div className="title">{issue.name}</div></div>
              <span className="end">تغيير</span>
            </button>
          )}
        </div>
      )}

      {step === 'text' && (
        <div className="stack">
          <h2 className="step-title">الصق النص أو اكتبه</h2>
          <ImageToText onText={t => { setRaw(r => (r.trim() ? r.trim() + ' ' + t : t)); setError('') }} />
          <textarea id="add-text" className="textarea" value={raw} onChange={e => { setRaw(e.target.value); setError('') }} placeholder="الصق نص المسألة أو التعريف كما ورد في الكتاب" autoFocus />
          <label className="field"><span>اللفظ المعرَّف (لا يدخل في المقارنة)</span>
            <input id="add-lead" className="input" value={effLead} onChange={e => { setLead(e.target.value); setLeadTouched(true) }} placeholder="يُستخرج تلقائياً إن جاء قبل نقطتين" />
          </label>
          {error && <p className="warn" role="alert">{error}</p>}
          <div className="sticky-foot">
            <button className="btn primary block" onClick={() => (body ? next('text') : setError('اكتب النص أولاً.'))}>التالي</button>
          </div>
        </div>
      )}

      {step === 'book' && (
        <Picker
          title="من أي كتاب؟"
          items={books.map(b => ({ id: b.id, title: b.title, meta: `${b.author} · ${yr(b)}` }))}
          selected={bookId}
          newLabel="كتاب جديد"
          renderNew={(q, close) => <BookForm onSaved={b => { setBookId(b.id); close(); next('book') }} onCancel={close} key={q} />}
          onPick={id => { setBookId(id); next('book') }}
        />
      )}

      {step === 'issue' && (
        <Picker
          title="في أي مسألة؟"
          items={issues.map(i => ({ id: i.id, title: i.name, meta: i.section ?? '' }))}
          selected={issueId}
          newLabel="مسألة جديدة"
          renderNew={(q, close) => <IssueForm initialName={q} onSaved={i => { setIssueId(i.id); close(); next('issue') }} onCancel={close} />}
          onPick={id => { setIssueId(id); next('issue') }}
        />
      )}

      {step === 'place' && (
        <div className="stack">
          <h2 className="step-title">موضعه في الكتاب</h2>
          <div className="row">
            <label className="field"><span>الجزء</span><input id="add-vol" className="input num" inputMode="numeric" value={volume} onChange={e => setVolume(e.target.value)} placeholder="١" /></label>
            <label className="field"><span>الصفحة</span><input id="add-page" className="input num" inputMode="numeric" value={page} onChange={e => setPage(e.target.value)} placeholder="٩٧" /></label>
          </div>
          <label className="field"><span>الطبعة أو التحقيق</span><input id="add-ed" className="input" value={edition} onChange={e => setEdition(e.target.value)} placeholder="المحقق والناشر وسنة الطبع" /></label>
          <label className="field"><span>ملاحظة</span><input id="add-note" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="اختياري" /></label>
          {duplicate && <p className="warn">في هذه المسألة نص محفوظ من الكتاب نفسه. يُحفظ هذا نصاً ثانياً بجانبه.</p>}
          {error && <p className="warn" role="alert">{error}</p>}
          <div className="sticky-foot">
            <button className="btn primary block" onClick={save}><Icon.Check />حفظ النص</button>
          </div>
        </div>
      )}

      {step === 'done' && <Result id={savedId} analysis={analysis} />}
    </>
  )
}

function Picker({ title, items, selected, newLabel, renderNew, onPick }: {
  title: string
  items: { id: string; title: string; meta: string }[]
  selected: string
  newLabel: string
  renderNew: (query: string, close: () => void) => ReactNode
  onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(items.length === 0)
  const shown = useMemo(() => {
    const t = q.trim()
    return t ? items.filter(i => i.title.includes(t) || i.meta.includes(t)) : items
  }, [q, items])

  return (
    <div className="stack">
      <h2 className="step-title">{title}</h2>
      {adding ? renderNew(q, () => setAdding(false)) : (
        <>
          <div className="search"><Icon.Search /><input id="pick-q" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث" /></div>
          <button className="btn block" onClick={() => setAdding(true)}><Icon.Plus />{newLabel}{q.trim() ? `: ${q.trim()}` : ''}</button>
          {shown.length > 0 && (
            <div className="list">
              {shown.map(i => (
                <button key={i.id} className={'item' + (i.id === selected ? ' selected' : '')} onClick={() => onPick(i.id)}>
                  <div className="grow"><div className="title">{i.title}</div>{i.meta && <div className="meta">{i.meta}</div>}</div>
                  {i.id === selected ? <Icon.Check /> : <Icon.ChevronIn />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Result({ id, analysis }: { id: string; analysis: ReturnType<typeof useStore>['analysis'] }) {
  const a = analysis.passages.get(id)
  if (!a) return <div className="empty">جارٍ التحليل…</div>
  const p = a.passage
  return (
    <div className="stack">
      <h2 className="step-title">حُفظ النص</h2>
      <div className="card">
        <div className="relline">
          <Badge relation={a.relation} />
          {a.source && <span><span className="num">{pct(a.source.cmp.sim)}</span> عن <b>{a.source.book.title}</b> <span className="small">{yr(a.source.book)}</span></span>}
        </div>
        <p className="text">
          {p.lead && <span className="lead">{p.lead} </span>}
          {a.source ? <DiffText ops={a.source.cmp.ops} novel={a.novel} /> : p.body}
        </p>
        {a.relation === 'first' && <p className="muted small" style={{ margin: 0 }}>هذا أقدم نص محفوظ في هذه المسألة حتى الآن.</p>}
        {a.close && a.candidates[1] && <p className="warn" style={{ margin: 0 }}>قريب بالدرجة نفسها من {a.candidates[1].book.title}، وقد يرجعان إلى أصل مشترك.</p>}
        {a.second && <p className="small muted" style={{ margin: 0 }}>ويظهر فيه أثر <b>{a.second.book.title}</b> في: {a.second.words.join('، ')}</p>}
      </div>
      <div className="stack tight">
        <Link className="btn primary block" to={sp(`/add?book=${p.bookId}`)}>نص آخر من الكتاب نفسه</Link>
        <Link className="btn block" to={sp(`/add?issue=${p.issueId}`)}>نص آخر في المسألة نفسها</Link>
        <Link className="btn ghost block" to={sp(`/issues/${p.issueId}#${p.id}`)}>عرض تطور المسألة</Link>
      </div>
    </div>
  )
}
