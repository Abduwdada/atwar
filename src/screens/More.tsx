import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { db, exportAll, importAll, newId, removeSample } from '../data/db'
import { useStore } from '../data/store'
import { ConfirmButton, PageHead, ar, useToast } from '../ui/bits'
import * as Icon from '../ui/icons'

export default function More() {
  const { sciences, science, setScienceId, hasSample, passages } = useStore()
  const [toast, say] = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)

  async function addScience(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('اكتب اسم العلم.')
    const id = newId()
    await db.sciences.add({ id, name: name.trim(), createdAt: Date.now() })
    setScienceId(id)
    setName('')
    say(`أُضيف علم ${name.trim()}`)
  }

  async function download() {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `atwar-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    say('حُفظت النسخة الاحتياطية')
  }

  async function upload(f: File | undefined) {
    if (!f) return
    try {
      const n = await importAll(JSON.parse(await f.text()))
      say(`استُرجع ${ar(n)} من النصوص`)
    } catch (err) {
      say(err instanceof Error && err.message.includes('أطوار') ? err.message : 'تعذرت قراءة الملف. تأكد أنه نسخة احتياطية من أطوار.')
    }
    if (file.current) file.current.value = ''
  }

  return (
    <>
      <PageHead title="المزيد" />

      <div className="stack tight">
        <div className="section-label">العلوم</div>
        <div className="list">
          {sciences.map(s => (
            <button key={s.id} className={'item' + (s.id === science?.id ? ' selected' : '')} onClick={() => setScienceId(s.id)}>
              <div className="grow"><div className="title">{s.name}</div></div>
              {s.id === science?.id && <Icon.Check />}
            </button>
          ))}
        </div>
        <form className="row" onSubmit={addScience} noValidate>
          <input id="more-science" className="input" value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="النحو" aria-label="اسم العلم الجديد" />
          <button className="btn" type="submit" style={{ flex: '0 0 auto' }}><Icon.Plus />علم جديد</button>
        </form>
        {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>

      <div className="stack tight">
        <div className="section-label">بياناتك</div>
        <div className="card">
          <span className="small muted">بياناتك محفوظة على هذا الجهاز وتعمل بلا إنترنت. احفظ نسخة احتياطية بين حين وآخر، وبها تنقل بياناتك إلى جهاز آخر حتى تُضاف المزامنة.</span>
          <div className="row">
            <button className="btn" onClick={download}><Icon.Download />حفظ نسخة احتياطية</button>
            <button className="btn" onClick={() => file.current?.click()}><Icon.Upload />استرجاع نسخة</button>
            <input ref={file} id="more-file" type="file" accept="application/json,.json" hidden onChange={e => upload(e.target.files?.[0])} />
          </div>
        </div>
      </div>

      {hasSample && (
        <div className="stack tight">
          <div className="section-label">العينة التجريبية</div>
          <div className="card">
            <span className="small muted">نصوص مكتوبة من الذاكرة لتجربة التطبيق. حذفها لا يمس نصوصك، وتبقى الكتب والمسائل التي أضفت إليها نصوصاً.</span>
            <ConfirmButton label="حذف العينة" confirm="حذف نصوص العينة؟" onConfirm={async () => { await removeSample(science!.id); say('حُذفت العينة') }} />
          </div>
        </div>
      )}

      <div className="stack tight">
        <div className="section-label">كيف يقرأ أطوار النصوص</div>
        <div className="card small">
          <p style={{ margin: 0 }}><b>توحيد الرسم:</b> تُحذف الحركات، وتوحَّد الهمزات والتاء المربوطة، وتجرَّد السوابق واللواحق عند المقارنة فقط.</p>
          <p style={{ margin: 0 }}><b>التشابه:</b> أطول تتابع مشترك من الألفاظ مع حفظ ترتيبها، مقسوماً على مجموع ألفاظ النصين.</p>
          <p style={{ margin: 0 }}><b>التصنيف:</b> من ٩٥٪ نقل بالنص؛ وإذا حوى المتأخر ٨٠٪ من مصدره وزاد فزيادة قيد، وعكسه اختصار؛ ثم إبدال يسير من ٨٠٪، وتصرف من ٦٠٪، وتأثر من ٣٠٪.</p>
          <p style={{ margin: 0 }}><b>النسب:</b> أصل الكتاب هو الكتاب الذي تراكم منه أعلى تشابه عبر المسائل، واختيارك للمصدر يقدَّم على اقتراح النظام.</p>
          <p style={{ margin: 0 }} className="muted">التشابه اللفظي قرينة لا دليل؛ قد يرجع نصان إلى أصل مشترك، وقد يتأثر كتاب بآخر في المعنى دون اللفظ.</p>
        </div>
      </div>

      <p className="small muted">أطوار · اسم مؤقت للمشروع · {ar(passages.length)} نصاً في هذا العلم · <Link to="/compare">مقارنة نصين</Link></p>
      {toast}
    </>
  )
}
