import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { prepare, recognize, type Rect } from '../ocr'
import { ar } from './bits'
import * as Icon from './icons'

// صورة الصفحة: تصويرها أو اختيارها أو لصقها، ثم تحديد موضع التعريف، ثم قراءته نصاً
export default function ImageToText({ onText }: { onText: (text: string) => void }) {
  const [src, setSrc] = useState('')
  const [rotation, setRotation] = useState(0)
  const [shown, setShown] = useState('') // الصورة بعد التدوير كما تُعرض للتحديد
  const [sel, setSel] = useState<Rect | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ p: number; label: string } | null>(null)
  const [note, setNote] = useState('')
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const load = (f: File | Blob | undefined | null) => {
    if (!f || !f.type.startsWith('image/')) return
    setSrc(URL.createObjectURL(f))
    setRotation(0)
    setSel(null)
    setNote('')
  }

  // لصق صورة من الحافظة، مثل لقطة شاشة من كتاب PDF
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'))
      if (item) { e.preventDefault(); load(item.getAsFile()) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // نسخة مدوّرة للعرض، حتى يطابق التحديد ما يراه المستخدم
  useEffect(() => {
    if (!src) { setShown(''); return }
    if (rotation === 0) { setShown(src); return }
    let url = ''
    prepare(src, rotation, null).then(c => c.toBlob(b => { if (b) { url = URL.createObjectURL(b); setShown(url) } }, 'image/jpeg', 0.9))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [src, rotation])

  const rel = (e: RPointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const down = (e: RPointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = rel(e); setSel(null) }
  const move = (e: RPointerEvent) => {
    if (!start.current) return
    const p = rel(e), s = start.current
    setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  const up = () => { start.current = null; setSel(s => (s && s.w > 0.02 && s.h > 0.01 ? s : null)) }

  async function read() {
    setBusy(true)
    setNote('')
    setProgress({ p: 0, label: 'تجهيز الصورة' })
    try {
      const canvas = await prepare(src, rotation, sel)
      const { text, confidence } = await recognize(canvas, (p, label) => setProgress({ p, label }))
      if (!text) setNote('لم يُعثر على نص. جرّب صورة أوضح، أو حدّد الجزء الذي فيه الكتابة.')
      else {
        onText(text)
        setNote(confidence < 70
          ? 'أُضيف النص، لكن وضوح الصورة ضعيف. راجعه جيداً قبل الحفظ.'
          : 'أُضيف النص إلى الخانة بالأسفل. راجعه وصحّح ما يلزم.')
      }
    } catch {
      setNote('تعذرت القراءة. أول استعمال يحتاج اتصالاً بالإنترنت لتنزيل ملف العربية.')
    }
    setProgress(null)
    setBusy(false)
  }

  const close = () => { setSrc(''); setSel(null); setNote('') }

  return (
    <div className="ocr">
      <input ref={camRef} id="ocr-cam" type="file" accept="image/*" capture="environment" hidden onChange={e => { load(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={fileRef} id="ocr-file" type="file" accept="image/*" hidden onChange={e => { load(e.target.files?.[0]); e.target.value = '' }} />
      {!src ? (
        <div className="ocr-start" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); load(e.dataTransfer.files?.[0]) }}>
          <div className="row">
            <button type="button" className="btn" onClick={() => camRef.current?.click()}><Icon.Camera />تصوير الصفحة</button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Icon.Image />من صورة</button>
          </div>
          <span className="small muted">أو اسحب صورة إلى هنا، أو الصقها. يُقرأ النص على جهازك ولا تُرفع الصورة لأي مكان.</span>
        </div>
      ) : (
        <div className="card ocr-card">
          <div className="small muted">{sel ? 'سيُقرأ الجزء المحدد فقط.' : 'اسحب على الصورة لتحديد موضع التعريف، أو اقرأ الصفحة كلها.'}</div>
          <div className="crop-box">
            {shown && (
              <div className="crop" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                <img ref={imgRef} src={shown} alt="صورة الصفحة" draggable={false} />
                {sel && <div className="crop-sel" style={{ left: `${sel.x * 100}%`, top: `${sel.y * 100}%`, width: `${sel.w * 100}%`, height: `${sel.h * 100}%` }} />}
              </div>
            )}
          </div>
          {progress && (
            <div className="ocr-progress" role="status">
              <span className="small">{progress.label}… {ar(Math.round(progress.p * 100))}٪</span>
              <span className="bar wide" aria-hidden="true"><i style={{ width: `${Math.round(progress.p * 100)}%` }} /></span>
            </div>
          )}
          {note && <p className="small" style={{ margin: 0 }}>{note}</p>}
          <div className="row ocr-actions">
            <button type="button" className="btn primary" onClick={read} disabled={busy}><Icon.Check />{busy ? 'جارٍ القراءة…' : sel ? 'قراءة الجزء المحدد' : 'قراءة الصفحة كلها'}</button>
            <button type="button" className="btn" onClick={() => { setRotation(r => (r + 90) % 360); setSel(null) }} disabled={busy}><Icon.Rotate />تدوير</button>
            {sel && <button type="button" className="btn ghost" onClick={() => setSel(null)} disabled={busy}>إلغاء التحديد</button>}
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} disabled={busy}>صورة أخرى</button>
            <button type="button" className="btn ghost" onClick={close} disabled={busy}>إغلاق</button>
          </div>
        </div>
      )}
    </div>
  )
}
