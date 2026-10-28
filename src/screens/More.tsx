import { useMemo, useRef, useState, type FormEvent } from 'react'
import ListEditor from '../ui/ListEditor'
import PhaseBar from '../ui/PhaseBar'
import ExcelPanel from '../ui/ExcelPanel'
import { suggestPhases, type Suggestion } from '../engine/phases'
import type { Phase } from '../data/types'
import SciencesManager from '../ui/SciencesManager'
import { toNum } from '../ui/forms'
import { analyseScience } from '../engine/analyse'
import { DEFAULT_TH, RELATIONS, type Relation, type Thresholds } from '../engine/compare'
import { useNavigate } from 'react-router-dom'
import { db, exportAll, importAll, removeSample } from '../data/db'
import { usePrefs } from '../data/prefs'
import { AuthError, ConflictError, DATA_REPO, HISTORY_URL } from '../data/remote'
import { useStore } from '../data/store'
import { Badge, ConfirmButton, PageHead, ar, count, useToast } from '../ui/bits'
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

export default function Settings() {
  const { canEdit, sync, dirty, pull, logout, localWorkHidden } = useStore()
  const { prefs, setPref } = usePrefs()
  const [toast, say] = useToast()
  const file = useRef<HTMLInputElement>(null)

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

  const Seg = <T extends string>({ id, value, options, onChange }: { id: string; value: T; options: [T, string][]; onChange: (v: T) => void }) => (
    <div className="seg" role="radiogroup" id={id}>
      {options.map(([v, label]) => <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>)}
    </div>
  )

  return (
    <>
      <PageHead title="الإعدادات" />

      <section className="stack tight">
        <div className="section-label">العرض</div>
        <div className="card settings">
          <div className="setting"><span>المظهر</span>
            <Seg id="set-theme" value={prefs.theme} onChange={v => setPref('theme', v)} options={[['system', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']]} />
          </div>
          <div className="setting"><span>حجم خط النصوص</span>
            <Seg id="set-size" value={prefs.textSize} onChange={v => setPref('textSize', v)} options={[['sm', 'صغير'], ['md', 'متوسط'], ['lg', 'كبير']]} />
          </div>
          <div className="setting"><span>ترتيب نصوص المسألة</span>
            <Seg id="set-order" value={prefs.oldestFirst ? 'old' : 'new'} onChange={v => setPref('oldestFirst', v === 'old')} options={[['old', 'الأقدم أولاً'], ['new', 'الأحدث أولاً']]} />
          </div>
          <div className="setting"><span>إظهار ما حذفه المتأخر من عبارة مصدره</span>
            <Seg id="set-del" value={prefs.showDel ? 'on' : 'off'} onChange={v => setPref('showDel', v === 'on')} options={[['on', 'إظهار'], ['off', 'إخفاء']]} />
          </div>
          <p className="text sample-text"><span className="lead">مثال: </span>ما يذم <ins>شرعاً</ins> تاركه {prefs.showDel && <del>ويلام</del>} قصداً</p>
        </div>
      </section>

      <section className="stack tight">
        <div className="section-label">{canEdit ? 'النشر' : 'المؤلف'}</div>
        {canEdit ? (
          <>
            <PublishBar />
            <div className="card">
              <span className="small muted">
                تعمل على نسخة في هذا الجهاز، ولا يرى الزوار شيئاً حتى تنشر.
                {sync && ` آخر نشر أو جلب: ${when(sync.at)}.`} سجل كل ما نُشر محفوظ في <a href={HISTORY_URL} target="_blank" rel="noreferrer">مستودع البيانات</a>.
              </span>
              <div className="row">
                <ConfirmButton label="جلب النسخة المنشورة" confirm={dirty ? 'تُستبدل تعديلاتك غير المنشورة. متأكد؟' : 'جلب المنشورة إلى هذا الجهاز؟'}
                  onConfirm={async () => { try { await pull(); say('جُلبت النسخة المنشورة') } catch (e) { say(e instanceof Error ? e.message : 'تعذر الجلب') } }} />
                <button className="btn sm ghost" onClick={logout}>خروج المؤلف</button>
              </div>
            </div>
          </>
        ) : (
          <>
            {localWorkHidden && <div className="note"><span><strong>على هذا الجهاز نصوص كتبتها قبل تفعيل النشر. </strong>ادخل بصفتك المؤلف لتظهر وتنشرها.</span></div>}
            <OwnerLogin />
          </>
        )}
      </section>

      {canEdit && (
        <section className="stack tight">
          <div className="section-label">نسخة احتياطية</div>
          <div className="card">
            <span className="small muted">ملف بكل ما على هذا الجهاز من العلوم والكتب والنصوص، منشوراً كان أو لا.</span>
            <div className="row">
              <button className="btn" onClick={download}><Icon.Download />حفظ نسخة احتياطية</button>
              <button className="btn" onClick={() => file.current?.click()}><Icon.Upload />استرجاع نسخة</button>
              <input ref={file} id="more-file" type="file" accept="application/json,.json" hidden onChange={e => upload(e.target.files?.[0])} />
            </div>
          </div>
        </section>
      )}

      {canEdit && (
        <section className="stack tight">
          <div className="section-label">العلوم ومجموعاتها</div>
          <SciencesManager />
        </section>
      )}

      <section className="stack tight">
        <div className="section-label">عن المنصة</div>
        <ol className="how">
          <li><b>جمع النصوص</b><span>يُنقل نص المسألة أو التعريف من كل كتاب، مع موضعه في الطبعة.</span></li>
          <li><b>المقارنة بما سبق</b><span>يقارَن كل نص بنصوص الكتب الأقدم وفاة، فيظهر النقل بالنص، وزيادة القيود، والاختصار، والتصرف.</span></li>
          <li><b>النسب والعائلات</b><span>تتراكم الصلات عبر المسائل، فتظهر شجرة الكتب ومن استفاد ممن، والعائلات المعرفية.</span></li>
        </ol>
        <div className="card small">
          <p style={{ margin: 0 }}><b>توحيد الرسم:</b> تُحذف الحركات، وتوحَّد الهمزات والتاء المربوطة، وتجرَّد السوابق واللواحق عند المقارنة فقط.</p>
          <p style={{ margin: 0 }}><b>التشابه:</b> أطول تتابع مشترك من الألفاظ مع حفظ ترتيبها، مقسوماً على مجموع ألفاظ النصين.</p>
          <p style={{ margin: 0 }}><b>التصنيف:</b> بحدود يضبطها المؤلف لكل علم من «إعدادات العلم».</p>
          <p style={{ margin: 0 }}><b>النسب:</b> أصل الكتاب هو الكتاب الذي تراكم منه أعلى تشابه عبر المسائل، وما يحدده المؤلف من مصادر يقدَّم على اقتراح النظام.</p>
          <p style={{ margin: 0 }} className="muted">التشابه اللفظي قرينة لا دليل؛ قد يرجع نصان إلى أصل مشترك، وقد يتأثر كتاب بآخر في المعنى دون اللفظ.</p>
        </div>
      </section>
      {toast}
    </>
  )
}

// إعدادات العلم: اسمه ووصفه، وحذف العينة، وحذفه كله
export function ScienceSettings() {
  const { science, hasSample, books, passages } = useStore()
  const nav = useNavigate()
  const [toast, say] = useToast()
  const [name, setName] = useState(science?.name ?? '')
  const [desc, setDesc] = useState(science?.description ?? '')
  const [error, setError] = useState('')
  if (!science) return null

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('اكتب اسم العلم.')
    await db.sciences.update(science!.id, { name: name.trim(), description: desc.trim() || undefined })
    say('حُفظت إعدادات العلم')
  }

  async function removeScience() {
    const sid = science!.id
    await db.transaction('rw', [db.sciences, db.books, db.issues, db.passages, db.links], async () => {
      await db.passages.where({ scienceId: sid }).delete()
      await db.links.where({ scienceId: sid }).delete()
      await db.issues.where({ scienceId: sid }).delete()
      await db.books.where({ scienceId: sid }).delete()
      await db.sciences.delete(sid)
    })
    nav('/')
  }

  return (
    <section className="stack narrow">
      <div className="card">
        <div className="setting">
          <span>ظهور العلم للزوار</span>
          <div className="seg" role="radiogroup" id="sci-visible">
            <button role="radio" aria-checked={!science.hidden} className={!science.hidden ? 'on' : ''} onClick={() => db.sciences.update(science.id, { hidden: undefined })}>منشور</button>
            <button role="radio" aria-checked={!!science.hidden} className={science.hidden ? 'on' : ''} onClick={() => db.sciences.update(science.id, { hidden: true })}>مخفي</button>
          </div>
        </div>
        <span className="small muted">
          {science.hidden
            ? 'العلم على جهازك فقط، ولا يدخل في النسخة المنشورة. انقله إلى «منشور» ثم اضغط «نشر» ليظهر للزوار.'
            : 'العلم يظهر للزوار بعد كل نشر. إن أخفيته ثم نشرت، يختفي من المنصة العامة ويبقى عندك.'}
        </span>
      </div>

      <div className="card">
        <div className="setting">
          <span>طريقة الرصد</span>
          <div className="seg" role="radiogroup" id="sci-mode">
            <button role="radio" aria-checked={science.mode !== 'books'} className={science.mode !== 'books' ? 'on' : ''} onClick={() => db.sciences.update(science.id, { mode: undefined })}>المسائل ونصوصها</button>
            <button role="radio" aria-checked={science.mode === 'books'} className={science.mode === 'books' ? 'on' : ''} onClick={() => db.sciences.update(science.id, { mode: 'books' })}>الكتب ومناهج التأليف</button>
          </div>
        </div>
        <span className="small muted">
          {science.mode === 'books'
            ? 'يُرصد العلم بكتبه وطرق التأليف فيها، كالمسانيد والسنن في الحديث، والتفسير بالمأثور وبالرأي. يظهر تبويب «مناهج التأليف» بدل المسائل والمصفوفة.'
            : 'يُرصد العلم بنصوص مسائله ومصطلحاته في كتبه، ومقارنة كل نص بما سبقه.'}
        </span>
      </div>

      <div className="section-label">مراحل تطور العلم</div>
      <PhasesEditor />

      <div className="section-label">استيراد وتصدير بالإكسل</div>
      <ExcelPanel />

      <form className="card" onSubmit={save} noValidate>
        <label className="field"><span>اسم العلم</span>
          <input id="sci-name" className="input" value={name} onChange={e => { setName(e.target.value); setError('') }} />
        </label>
        <label className="field"><span>وصف قصير يظهر في رأس صفحة العلم</span>
          <textarea id="sci-desc" className="input" style={{ minHeight: 90 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="مثل: تتبّع تعريفات أصول الفقه من المعتمد إلى إرشاد الفحول" />
        </label>
        {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div><button className="btn primary" type="submit">حفظ</button></div>
      </form>

      <div className="section-label">القوائم</div>
      <span className="small muted" style={{ marginTop: -8 }}>ما تختار منه عند إضافة كتاب أو مسألة. تعديل اسم عنصر يسري على كل ما يحمله، وحذفه يزيله منها.</span>
      <ListEditor k="schools" />
      <ListEditor k="kinds" />
      <ListEditor k="sections" />
      <ListEditor k="methods" />

      <div className="section-label">حدود التصنيف</div>
      <ThresholdsEditor />

      {hasSample && (
        <div className="card">
          <strong>العينة التجريبية</strong>
          <span className="small muted">نصوص مكتوبة من الذاكرة لتجربة المنصة. حذفها لا يمس نصوصك، ثم انشر ليختفي من النسخة العامة.</span>
          <ConfirmButton label="حذف العينة" confirm="حذف نصوص العينة؟" onConfirm={async () => { await removeSample(science.id); say('حُذفت العينة') }} />
        </div>
      )}

      <div className="card danger-zone">
        <strong>حذف العلم</strong>
        <span className="small muted">يُحذف العلم ومعه {count(books.length, 'كتاب', 'كتابان', 'كتب', 'كتاباً')} و{count(passages.length, 'نص', 'نصان', 'نصوص', 'نصاً')} من هذا الجهاز. ويختفي من النسخة العامة بعد النشر.</span>
        <ConfirmButton label="حذف العلم" confirm="حذف العلم وكل ما فيه؟" onConfirm={removeScience} />
      </div>
      {toast}
    </section>
  )
}

const TH_ROWS: [keyof Thresholds, string, string][] = [
  ['verbatim', 'نقل بالنص', 'إذا بلغ التشابه هذه النسبة فأكثر'],
  ['cover', 'زيادة قيد أو اختصار', 'إذا حوى أحد النصين هذه النسبة من ألفاظ الآخر وزاد عليه أو نقص عنه'],
  ['substitute', 'نقل مع إبدال يسير', 'من هذه النسبة'],
  ['adapt', 'نقل مع تصرف', 'من هذه النسبة'],
  ['influence', 'تأثر في الصياغة', 'من هذه النسبة، وما دونها صياغة مستقلة'],
]
const toPct = (t: Thresholds) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, String(Math.round(v * 100))])) as Record<keyof Thresholds, string>

function ThresholdsEditor() {
  const { science, thresholds, passages, books } = useStore()
  const [d, setD] = useState(() => toPct(thresholds))
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const th = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, toNum(v) / 100])) as unknown as Thresholds
  const valid = Object.values(th).every(v => v > 0 && v <= 1)
  // معاينة: كم نصاً يقع في كل تصنيف بهذه الحدود
  const dist = useMemo(() => {
    if (!valid) return null
    const m = new Map<Relation, number>()
    analyseScience(passages, books, th).passages.forEach(a => m.set(a.relation, (m.get(a.relation) ?? 0) + 1))
    return m
  }, [d, passages, books]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!valid) return setError('كل نسبة بين ١ و١٠٠.')
    if (!(th.verbatim >= th.substitute && th.substitute >= th.adapt && th.adapt >= th.influence))
      return setError('رتّب النسب تنازلياً: النقل بالنص، ثم الإبدال، ثم التصرف، ثم التأثر.')
    await db.sciences.update(science!.id, { thresholds: th })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  async function reset() {
    setD(toPct(DEFAULT_TH))
    await db.sciences.update(science!.id, { thresholds: undefined })
  }

  return (
    <div className="card">
      <span className="small muted">تحدد متى يُعدّ النص نقلاً أو تصرفاً أو تأثراً. اضبطها على ما تراه في علمك، والتصنيفات كلها تتحدث فوراً.</span>
      <div className="th-grid">
        {TH_ROWS.map(([k, label, hint]) => (
          <label key={k} className="th-row" htmlFor={`th-${k}`}>
            <span><b>{label}</b><small className="muted">{hint}</small></span>
            <span className="th-input"><input id={`th-${k}`} className="input num" inputMode="numeric" value={ar(d[k])} onChange={e => { setD({ ...d, [k]: String(toNum(e.target.value) || '') }); setError('') }} />٪</span>
          </label>
        ))}
      </div>
      {dist && (
        <div className="th-dist">
          <span className="small muted">بهذه الحدود:</span>
          {(Object.keys(RELATIONS) as Relation[]).filter(r => dist.get(r)).map(r => <span key={r} className="small"><Badge relation={r} /> {ar(dist.get(r)!)}</span>)}
        </div>
      )}
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn primary" onClick={save}>{saved ? 'حُفظت' : 'حفظ الحدود'}</button>
        <button className="btn ghost" onClick={reset}>الحدود الافتراضية</button>
      </div>
    </div>
  )
}

function PhasesEditor() {
  const { science, books, analysis } = useStore()
  const [rows, setRows] = useState<Phase[]>(science?.phases ?? [])
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  if (!science) return null
  const set = (i: number, patch: Partial<Phase>) => { setRows(r => r.map((p, k) => (k === i ? { ...p, ...patch } : p))); setError(''); setSaved(false) }

  async function save() {
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i]
      if (!p.name.trim()) return setError('لكل مرحلة اسم.')
      if (!(p.from < p.to)) return setError(`في «${p.name}» يجب أن تكون البداية قبل النهاية.`)
      if (i && p.from < rows[i - 1].from) return setError('رتّب المراحل من الأقدم إلى الأحدث.')
    }
    await db.sciences.update(science!.id, { phases: rows.length ? rows.map(p => ({ ...p, name: p.name.trim() })) : undefined })
    setSaved(true)
  }

  return (
    <div className="card">
      <span className="small muted">مراحل يمر بها العلم، كالنشأة والتكوين ثم التطور والتوسع ثم التمكن والنضج. تظهر في نظرة العلم، وبها تُقارن العلوم في خارطة التطور. اقترحها من بياناتك ثم عدّلها بما تراه.</span>
      {rows.length > 0 && (
        <div className="phase-rows">
          {rows.map((p, i) => (
            <div className="phase-row" key={i}>
              <input id={`ph-name-${i}`} className="input" value={p.name} onChange={e => set(i, { name: e.target.value })} aria-label="اسم المرحلة" />
              <label className="th-input">من<input id={`ph-from-${i}`} className="input num" inputMode="numeric" value={ar(p.from)} onChange={e => set(i, { from: toNum(e.target.value) || 0 })} /></label>
              <label className="th-input">إلى<input id={`ph-to-${i}`} className="input num" inputMode="numeric" value={ar(p.to)} onChange={e => set(i, { to: toNum(e.target.value) || 0 })} />هـ</label>
              <button className="icon-btn" onClick={() => setRows(r => r.filter((_, k) => k !== i))} aria-label="حذف المرحلة"><Icon.Trash /></button>
              {p.note && <span className="small muted phase-note">{p.note}</span>}
            </div>
          ))}
        </div>
      )}
      {suggestion && (
        <div className="card suggest-box">
          {suggestion.phases.length ? (
            <>
              <strong>الاقتراح من بيانات العلم</strong>
              <PhaseBar phases={suggestion.phases} books={books} />
              <ul className="small" style={{ margin: 0, paddingRight: 18 }}>
                {suggestion.phases.map((p, i) => <li key={i}><b>{p.name}</b> ({ar(p.from)}–{ar(p.to)}هـ): {p.note}</li>)}
              </ul>
              <div className="row">
                <button className="btn primary sm" onClick={() => { setRows(suggestion.phases); setSuggestion(null); setSaved(false) }}>اعتماد الاقتراح</button>
                <button className="btn sm" onClick={() => setSuggestion(null)}>إلغاء</button>
              </div>
            </>
          ) : <span className="small">{suggestion.reason}</span>}
        </div>
      )}
      {error && <p className="warn" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn sm" onClick={() => setSuggestion(suggestPhases(books, [...analysis.passages.values()]))}>اقتراح من البيانات</button>
        <button className="btn sm" onClick={() => { const last = rows.at(-1); setRows(r => [...r, { name: 'مرحلة جديدة', from: last?.to ?? (books[0]?.death ?? 100), to: (last?.to ?? (books[0]?.death ?? 100)) + 100 }]) }}><Icon.Plus />مرحلة</button>
        <button className="btn sm primary" onClick={save}>{saved ? 'حُفظت' : 'حفظ المراحل'}</button>
      </div>
    </div>
  )
}
