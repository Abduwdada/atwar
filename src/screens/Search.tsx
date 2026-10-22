import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { tokenize } from '../engine/arabic'
import { Badge, PageHead, ar, yr } from '../ui/bits'
import * as Icon from '../ui/icons'

// يطابق على الصورة الموحدة للألفاظ، فلا تؤثر الحركات ولا الهمزات ولا «ال» في النتائج
const keys = (s: string) => tokenize(s).map(t => t.key)
const matches = (hay: string, needle: string[]) => {
  const h = keys(hay)
  return needle.every(n => h.some(k => k.includes(n)))
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [draft, setDraft] = useState(q)
  const { books, issues, passages, analysis, issueById } = useStore()
  const needle = keys(q)

  const rIssues = needle.length ? issues.filter(i => matches(`${i.name} ${i.section ?? ''}`, needle)) : []
  const rBooks = needle.length ? books.filter(b => matches(`${b.title} ${b.author} ${b.school ?? ''}`, needle)) : []
  const rPassages = needle.length ? passages.filter(p => matches(`${p.lead} ${p.body}`, needle)).map(p => analysis.passages.get(p.id)!).filter(Boolean)
    .sort((a, b) => a.book.death - b.book.death) : []
  const total = rIssues.length + rBooks.length + rPassages.length

  return (
    <>
      <PageHead title="البحث" sub={q && `${ar(total)} نتيجة لـ «${q}»`} />
      <form className="search" onSubmit={e => { e.preventDefault(); setParams(draft.trim() ? { q: draft.trim() } : {}) }}>
        <Icon.Search />
        <input id="search-q" className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="قصداً مطلقاً، المحصول، الحكم…" autoFocus aria-label="بحث" />
      </form>

      {rIssues.length > 0 && (
        <section className="stack tight">
          <div className="section-label">المسائل</div>
          <div className="list">{rIssues.map(i => <Link key={i.id} className="item" to={`/issues/${i.id}`}><div className="grow"><div className="title">{i.name}</div>{i.section && <div className="meta">{i.section}</div>}</div><Icon.ChevronIn /></Link>)}</div>
        </section>
      )}
      {rBooks.length > 0 && (
        <section className="stack tight">
          <div className="section-label">الكتب</div>
          <div className="list">{rBooks.map(b => <Link key={b.id} className="item" to={`/books/${b.id}`}><div className="grow"><div className="title">{b.title}</div><div className="meta">{b.author} · {yr(b)}</div></div><Icon.ChevronIn /></Link>)}</div>
        </section>
      )}
      {rPassages.length > 0 && (
        <section className="stack tight">
          <div className="section-label">النصوص، مرتبة زمنياً</div>
          <div className="list">
            {rPassages.map(a => (
              <Link key={a.passage.id} className="item" to={`/issues/${a.passage.issueId}#${a.passage.id}`} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="title">{a.book.title} <span className="small muted">{yr(a.book)} · {issueById.get(a.passage.issueId)?.name}</span></div>
                  <div style={{ fontFamily: 'var(--f-text)', fontSize: 18, lineHeight: 1.9 }}>{a.passage.body}</div>
                </div>
                <Badge relation={a.relation} manual={a.manual} />
              </Link>
            ))}
          </div>
        </section>
      )}
      {q && !total && <div className="empty card">لا نتائج. جرّب لفظاً أقصر أو جذراً آخر.</div>}
      {!q && <p className="muted small">ابحث بلفظ من تعريف لتعرف أين ورد ومتى ظهر أول مرة، أو باسم كتاب أو مؤلف أو مسألة.</p>}
    </>
  )
}
