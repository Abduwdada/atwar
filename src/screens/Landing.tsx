import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { ar, count } from '../ui/bits'
import * as Icon from '../ui/icons'

// الواجهة العامة للمنصة: ما هي، والعلوم المرصودة فيها
export default function Landing() {
  const { sciences, scienceStats, setScienceId, canEdit } = useStore()
  const nav = useNavigate()
  const open = (id: string) => { setScienceId(id); nav('/science') }

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
          {canEdit && <Link to="/more">علم جديد</Link>}
        </div>
        {sciences.length ? (
          <div className="science-grid">
            {sciences.map(s => {
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
        ) : <div className="empty card">لم يُنشر أي علم بعد.</div>}
      </section>

      <section className="stack tight">
        <div className="section-head"><h2>كيف تعمل المنصة</h2></div>
        <ol className="how">
          <li><b>جمع النصوص</b><span>يُنقل نص المسألة أو التعريف من كل كتاب، مع موضعه في الطبعة.</span></li>
          <li><b>المقارنة بما سبق</b><span>يقارَن كل نص بنصوص الكتب الأقدم وفاة، فيظهر النقل بالنص، وزيادة القيود، والاختصار، والتصرف.</span></li>
          <li><b>النسب والعائلات</b><span>تتراكم الصلات عبر المسائل، فتظهر شجرة الكتب ومن استفاد ممن، والعائلات المعرفية.</span></li>
        </ol>
        <p className="small muted" style={{ margin: '0 4px' }}>التشابه في اللفظ قرينة لا دليل، والحكم الأخير للباحث؛ لذلك تُعرض الصلات المعلنة في كتب التراجم بجانب ما تستنتجه المنصة.</p>
      </section>
    </>
  )
}
