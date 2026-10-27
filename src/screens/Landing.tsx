import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, newId } from '../data/db'
import { useStore } from '../data/store'
import { ar, count } from '../ui/bits'
import * as Icon from '../ui/icons'
import { groupSciences } from '../ui/SciencesManager'

// الواجهة العامة للمنصة: ما هي، والعلوم المرصودة فيها
export default function Landing() {
  const { sciences, groups, scienceStats, canEdit } = useStore()
  const nav = useNavigate()
  const open = (id: string) => nav(`/s/${id}`)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function addScience(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('اكتب اسم العلم.')
    const id = newId()
    await db.sciences.add({ id, name: name.trim(), createdAt: Date.now() })
    nav(`/s/${id}/books`)
  }

  return (
    <>
      <section className="hero">
        <span className="eyebrow">منصة لرصد تطور العلوم</span>
        <h1>أطوار</h1>
        <p className="lede">
          كيف نضجت المسائل والمصطلحات في كل علم عبر القرون؟ تجمع المنصة نص المسألة الواحدة من الكتب بترتيبها الزمني،
          وتبيّن ما نقله كل مصنف عمن قبله، وما زاد عليه أو اختصره أو استدركه، ومنها تتكوّن شجرة الكتب وعائلاتها المعرفية.
        </p>
      </section>

      <section className="stack tight">
        <div className="section-head">
          <h2>العلوم المرصودة</h2>
          {canEdit && <button className="btn sm" onClick={() => setAdding(a => !a)}><Icon.Plus />علم جديد</button>}
        </div>
        {adding && (
          <form className="card" onSubmit={addScience} noValidate>
            <label className="field"><span>اسم العلم</span>
              <input id="new-science" className="input" value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="مثل: النحو، أو مصطلح الحديث" autoFocus />
            </label>
            {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
            <div className="row"><button className="btn primary" type="submit">إنشاء العلم</button><button className="btn" type="button" onClick={() => setAdding(false)}>إلغاء</button></div>
          </form>
        )}
        {sciences.length ? groupSciences(sciences, groups).map(({ group, items }) => (
          <div className="stack tight" key={group?.id ?? 'rest'}>
            {(group || groups.length > 0) && <div className="section-label">{group?.name ?? 'علوم أخرى'}</div>}
          <div className="science-grid">
            {items.map(s => {
              const st = scienceStats.get(s.id)
              return (
                <button key={s.id} className="science-card" onClick={() => open(s.id)}>
                  <span className="science-name">{s.name}</span>
                  <span className="small muted">
                    {st ? [count(st.books, 'كتاب', 'كتابان', 'كتب', 'كتاباً'), count(st.issues, 'مسألة', 'مسألتان', 'مسائل', 'مسألة'), count(st.passages, 'نص', 'نصان', 'نصوص', 'نصاً')].join(' · ') : 'لم تُضف نصوص بعد'}
                  </span>
                  {st?.from !== undefined && st.to !== undefined && st.to > st.from && (
                    <span className="span-line" aria-label={`من ${ar(st.from)}هـ إلى ${ar(st.to)}هـ`}>
                      <span className="num">{ar(st.from)}هـ</span><i /><span className="num">{ar(st.to)}هـ</span>
                    </span>
                  )}
                  {st?.sample && <span className="badge sf">عينة تجريبية</span>}
                  <span className="science-go">استعرض العلم <Icon.ChevronIn /></span>
                </button>
              )
            })}
          </div>
          </div>
        )) : <div className="empty card">لم يُنشر أي علم بعد.</div>}
      </section>

    </>
  )
}
