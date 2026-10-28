import { useRef, useState } from 'react'
import { useStore } from '../data/store'
import { applyImport, exportScience, planImport, planSize, type Plan } from '../data/excel'
import { ar, count } from './bits'
import * as Icon from './icons'

// تنزيل ملف العلم، ثم استيراده بعد التعديل مع معاينة ما سيُضاف ويُحدَّث قبل التنفيذ
export default function ExcelPanel() {
  const { science, books, issues, passages, authors } = useStore()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  if (!science) return null
  const data = { science, books, issues, passages, authors }

  async function download() {
    setBusy(true)
    const blob = await exportScience(data)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `أطوار - ${science!.name}.xlsx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setBusy(false)
  }

  async function read(f: File | undefined) {
    if (!f) return
    setBusy(true); setMsg(''); setPlan(null)
    try {
      setPlan(await planImport(f, data))
    } catch {
      setMsg('تعذرت قراءة الملف. تأكد أنه ملف إكسل (xlsx).')
    }
    setBusy(false)
    if (file.current) file.current.value = ''
  }

  async function apply() {
    if (!plan) return
    setBusy(true)
    await applyImport(plan)
    setMsg(`استُورد الملف: ${count(planSize(plan), 'تغيير واحد', 'تغييران', 'تغييرات', 'تغييراً')}. انشر ليظهر للزوار.`)
    setPlan(null)
    setBusy(false)
  }

  const line = (label: string, add: number, upd: number) =>
    add + upd > 0 && <li key={label}><b>{label}:</b> {[add && `يُضاف ${ar(add)}`, upd && `يُحدَّث ${ar(upd)}`].filter(Boolean).join('، ')}</li>

  return (
    <div className="card">
      <span className="small muted">
        نزّل ملف العلم ببياناته، وأضف إليه أو عدّل فيه بالإكسل، ثم استورده. الصفوف الجديدة تُضاف، والموجودة تُحدَّث، ولا يُحذف شيء.
        فيه ورقة «المصفوفة» على هيئة جدولك المعتاد: المسائل صفوفاً والكتب أعمدة.
      </span>
      <div className="row">
        <button className="btn" onClick={download} disabled={busy}><Icon.Download />تنزيل ملف العلم</button>
        <button className="btn" onClick={() => file.current?.click()} disabled={busy}><Icon.Upload />استيراد ملف</button>
        <input ref={file} id="xl-file" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={e => read(e.target.files?.[0])} />
      </div>
      {busy && <span className="small muted">جارٍ العمل…</span>}
      {plan && (
        <div className="card suggest-box">
          <strong>معاينة الاستيراد</strong>
          {planSize(plan) ? (
            <ul className="small" style={{ margin: 0, paddingRight: 18 }}>
              {line('الكتب', plan.books.add.length, plan.books.update.length)}
              {line('المسائل', plan.issues.add.length, plan.issues.update.length)}
              {line('النصوص', plan.passages.add.length, plan.passages.update.length)}
              {line('المؤلفون', plan.authors.add.length, plan.authors.update.length)}
            </ul>
          ) : <span className="small">لا جديد في الملف؛ كل صفوفه مطابقة لما في المنصة.</span>}
          {plan.skipped > 0 && <span className="small muted">{count(plan.skipped, 'صف', 'صفان', 'صفوف', 'صفاً')} مطابق لما في المنصة فلن يتغير.</span>}
          {plan.errors.length > 0 && (
            <div className="small">
              <b className="warn">{count(plan.errors.length, 'صف', 'صفان', 'صفوف', 'صفاً')} فيه مشكلة ولن يُستورد:</b>
              <ul style={{ margin: 0, paddingRight: 18 }}>{plan.errors.slice(0, 15).map((e, i) => <li key={i}>{e}</li>)}</ul>
              {plan.errors.length > 15 && <span className="muted">وغيرها {ar(plan.errors.length - 15)}.</span>}
            </div>
          )}
          <div className="row">
            {planSize(plan) > 0 && <button className="btn primary sm" onClick={apply} disabled={busy}>تنفيذ الاستيراد</button>}
            <button className="btn sm" onClick={() => setPlan(null)}>إلغاء</button>
          </div>
        </div>
      )}
      {msg && <span className="small" role="status">{msg}</span>}
    </div>
  )
}
