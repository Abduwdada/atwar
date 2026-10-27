import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { db, exportAll, importAll, newId, removeSample } from '../data/db'
import { AuthError, ConflictError, DATA_REPO, HISTORY_URL } from '../data/remote'
import { useStore } from '../data/store'
import { ConfirmButton, PageHead, ar, useToast } from '../ui/bits'
import * as Icon from '../ui/icons'

const when = (t: number) => new Date(t).toLocaleString('ar-SA-u-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' })

// شريط حالة النشر يظهر للمؤلف في الرئيسية وفي «المزيد»
export function PublishBar() {
  const { dirty, sync, publish, pull } = useStore()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [conflict, setConflict] = useState(false)
  const [note, setNote] = useState('')

  async function run(force = false) {
    setBusy(true)
    setMsg('')
    try {
      await publish(note.trim() || 'تحديث النصوص', force)
      setConflict(false)
      setNote('')
      setMsg('نُشر. يظهر للزوار خلال دقائق.')
    } catch (e) {
      if (e instanceof ConflictError) setConflict(true)
      else setMsg(e instanceof Error ? e.message : 'تعذر النشر.')
    }
    setBusy(false)
  }

  if (!dirty && !conflict)
    return (
      <div className="pubbar ok">
        <Icon.Check />
        <span className="grow">{sync ? `كل ما على جهازك منشور · آخر مزامنة ${when(sync.at)}` : 'لم يُنشر شيء من هذا الجهاز بعد'}</span>
        {msg && <span className="small">{msg}</span>}
      </div>
    )

  return (
    <div className="pubbar">
      <div className="stack tight grow">
        <strong>{conflict ? 'نُشرت نسخة أحدث من جهاز آخر' : 'عندك تعديلات لم تُنشر'}</strong>
        {conflict ? (
          <span className="small">إن نشرت الآن استبدلت النسخة الأحدث بما على هذا الجهاز. وإن جلبتها استُبدلت تعديلات هذا الجهاز.</span>
        ) : (
          <input id="pub-note" className="input" style={{ minHeight: 40 }} value={note} onChange={e => setNote(e.target.value)} placeholder="وصف التحديث (اختياري): أضفت تعريف المندوب من خمسة كتب" />
        )}
        {msg && <span className="small warn">{msg}</span>}
      </div>
      <div className="row" style={{ flex: '0 0 auto' }}>
        {conflict ? (
          <>
            <button className="btn sm" disabled={busy} onClick={async () => { setBusy(true); await pull(); setConflict(false); setBusy(false) }}>جلب الأحدث</button>
            <button className="btn sm danger" disabled={busy} onClick={() => run(true)}>نشر على أي حال</button>
          </>
        ) : (
          <button className="btn primary sm" disabled={busy} onClick={() => run()}><Icon.Upload />{busy ? 'جارٍ النشر…' : 'نشر'}</button>
        )}
      </div>
    </div>
  )
}

function OwnerLogin() {
  const { login } = useStore()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token.trim()) return setError('الصق مفتاح الوصول.')
    setBusy(true)
    try {
      await login(token.trim())
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'تعذر التحقق من المفتاح. تأكد من الاتصال وحاول مرة أخرى.')
    }
    setBusy(false)
  }

  if (!open)
    return (
      <div className="card">
        <strong>دخول المؤلف</strong>
        <span className="small muted">الإضافة والتعديل والنشر لصاحب المنصة فقط. ادخل بمفتاح الوصول لتظهر لك أدوات التحكم.</span>
        <div><button className="btn primary" onClick={() => setOpen(true)}>دخول المؤلف</button></div>
      </div>
    )
  return (
    <form className="card" onSubmit={submit} noValidate>
      <strong>دخول المؤلف</strong>
      <span className="small muted">
        الإضافة والنشر لصاحب المنصة وحده. أنشئ مرة واحدة مفتاح وصول من حسابك في GitHub: الإعدادات، ثم Developer settings، ثم Fine-grained tokens.
        اختر المستودع <b dir="ltr">{DATA_REPO.repo}</b> وحده (<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">صفحة إنشاء المفتاح</a>)، وامنحه صلاحية Contents للقراءة والكتابة، ثم الصق المفتاح هنا. يُحفظ على هذا الجهاز فقط.
      </span>
      <input id="owner-token" className="input" dir="ltr" type="password" autoComplete="off" value={token} onChange={e => { setToken(e.target.value); setError('') }} placeholder="github_pat_…" aria-label="مفتاح الوصول" />
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'جارٍ التحقق…' : 'دخول'}</button>
        <button className="btn" type="button" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </form>
  )
}

export default function More() {
  const { sciences, science, setScienceId, hasSample, passages, canEdit, sync, dirty, pull, logout, localWorkHidden } = useStore()
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
    const blob = new Blob([JSON.stringify(await exportAll(), null, 1)], { type: 'application/json' })
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
      {!canEdit && <OwnerLogin />}

      {canEdit ? (
        <div className="stack tight">
          <div className="section-label">النشر</div>
          <PublishBar />
          <div className="card">
            <span className="small muted">
              تعمل على نسخة في هذا الجهاز، ولا يرى الزوار شيئاً حتى تنشر.
              {sync && ` آخر نشر أو جلب: ${when(sync.at)}.`} سجل كل ما نُشر محفوظ في <a href={HISTORY_URL} target="_blank" rel="noreferrer">مستودع البيانات</a>.
            </span>
            {!sync && <span className="small">على هذا الجهاز نصوص لم تُقارن بالمنشورة. انشرها لتصير هي النسخة العامة، أو اجلب المنشورة لتستبدلها.</span>}
            <div className="row">
              <ConfirmButton label="جلب النسخة المنشورة" confirm={dirty ? 'تُستبدل تعديلاتك غير المنشورة. متأكد؟' : 'جلب المنشورة إلى هذا الجهاز؟'}
                onConfirm={async () => { try { await pull(); say('جُلبت النسخة المنشورة') } catch (e) { say(e instanceof Error ? e.message : 'تعذر الجلب') } }} />
              <button className="btn sm ghost" onClick={logout}>خروج المؤلف</button>
            </div>
          </div>
        </div>
      ) : localWorkHidden ? (
        <div className="note"><span><strong>على هذا الجهاز نصوص كتبتها قبل تفعيل النشر. </strong>ادخل بصفتك المؤلف لتظهر وتنشرها.</span></div>
      ) : null}

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
        {canEdit && (
          <form className="row" onSubmit={addScience} noValidate>
            <input id="more-science" className="input" value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="النحو" aria-label="اسم العلم الجديد" />
            <button className="btn" type="submit" style={{ flex: '0 0 auto' }}><Icon.Plus />علم جديد</button>
          </form>
        )}
        {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>

      {canEdit && (
        <div className="stack tight">
          <div className="section-label">نسخة احتياطية</div>
          <div className="card">
            <span className="small muted">ملف بكل ما على هذا الجهاز، منشوراً كان أو لا.</span>
            <div className="row">
              <button className="btn" onClick={download}><Icon.Download />حفظ نسخة احتياطية</button>
              <button className="btn" onClick={() => file.current?.click()}><Icon.Upload />استرجاع نسخة</button>
              <input ref={file} id="more-file" type="file" accept="application/json,.json" hidden onChange={e => upload(e.target.files?.[0])} />
            </div>
          </div>
        </div>
      )}

      {canEdit && hasSample && (
        <div className="stack tight">
          <div className="section-label">العينة التجريبية</div>
          <div className="card">
            <span className="small muted">نصوص مكتوبة من الذاكرة لتجربة المنصة. حذفها لا يمس نصوصك، ثم انشر ليختفي من النسخة العامة.</span>
            <ConfirmButton label="حذف العينة" confirm="حذف نصوص العينة؟" onConfirm={async () => { await removeSample(science!.id); say('حُذفت العينة') }} />
          </div>
        </div>
      )}

      <div className="stack tight">
        <div className="section-label">كيف تقرأ المنصة النصوص</div>
        <div className="card small">
          <p style={{ margin: 0 }}><b>توحيد الرسم:</b> تُحذف الحركات، وتوحَّد الهمزات والتاء المربوطة، وتجرَّد السوابق واللواحق عند المقارنة فقط.</p>
          <p style={{ margin: 0 }}><b>التشابه:</b> أطول تتابع مشترك من الألفاظ مع حفظ ترتيبها، مقسوماً على مجموع ألفاظ النصين.</p>
          <p style={{ margin: 0 }}><b>التصنيف:</b> من ٩٥٪ نقل بالنص؛ وإذا حوى المتأخر ٨٠٪ من مصدره وزاد فزيادة قيد، وعكسه اختصار؛ ثم إبدال يسير من ٨٠٪، وتصرف من ٦٠٪، وتأثر من ٣٠٪.</p>
          <p style={{ margin: 0 }}><b>النسب:</b> أصل الكتاب هو الكتاب الذي تراكم منه أعلى تشابه عبر المسائل، وما يحدده المؤلف من مصادر يقدَّم على اقتراح النظام.</p>
          <p style={{ margin: 0 }} className="muted">التشابه اللفظي قرينة لا دليل؛ قد يرجع نصان إلى أصل مشترك، وقد يتأثر كتاب بآخر في المعنى دون اللفظ.</p>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="small muted" style={{ flex: '1 1 auto' }}>أطوار · {ar(passages.length)} نصاً في هذا العلم · <Link to="/compare">مقارنة نصين</Link></span>
      </div>
      {toast}
    </>
  )
}
