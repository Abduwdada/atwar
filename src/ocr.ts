import type { Worker } from 'tesseract.js'

// استخراج النص من الصور على الجهاز نفسه؛ أول استعمال ينزّل الأداة وملف العربية ثم تُحفظ للعمل بلا إنترنت
export type Rect = { x: number; y: number; w: number; h: number } // أجزاء من ١ نسبةً إلى الصورة

let workerP: Promise<Worker> | null = null
let report: ((progress: number, label: string) => void) | null = null

const LABELS: Record<string, string> = {
  'loading tesseract core': 'تجهيز أداة القراءة',
  'initializing tesseract': 'تجهيز أداة القراءة',
  'initialized tesseract': 'تجهيز أداة القراءة',
  'loading language traineddata': 'تنزيل ملف العربية (أول مرة فقط)',
  'loaded language traineddata': 'تنزيل ملف العربية (أول مرة فقط)',
  'initializing api': 'تجهيز القراءة',
  'initialized api': 'تجهيز القراءة',
  'recognizing text': 'قراءة النص',
}

function getWorker() {
  if (!workerP) {
    workerP = import('tesseract.js').then(T =>
      T.createWorker('ara', T.OEM.LSTM_ONLY, {
        logger: m => report?.(m.progress ?? 0, LABELS[m.status] ?? 'جارٍ العمل'),
      }))
    workerP.catch(() => { workerP = null })
  }
  return workerP
}

// تدوير الصورة وقصّ الجزء المحدد وتكبيره وتحويله إلى رمادي، فتتحسن القراءة
export async function prepare(src: string, rotation: number, crop: Rect | null): Promise<HTMLCanvasElement> {
  const img = new Image()
  img.src = src
  await img.decode()
  const quarter = rotation % 180 !== 0
  const rw = quarter ? img.naturalHeight : img.naturalWidth
  const rh = quarter ? img.naturalWidth : img.naturalHeight
  const r = crop ?? { x: 0, y: 0, w: 1, h: 1 }
  const sw = Math.max(1, Math.round(r.w * rw)), sh = Math.max(1, Math.round(r.h * rh))
  // السطر الواحد يُقرأ أفضل إذا كان ارتفاع الحرف نحو ثلاثين نقطة
  const scale = Math.min(3, Math.max(1, 1800 / sw))
  const out = document.createElement('canvas')
  out.width = Math.round(sw * scale)
  out.height = Math.round(sh * scale)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.scale(scale, scale)
  ctx.translate(-r.x * rw, -r.y * rh)
  ctx.translate(rw / 2, rh / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  const data = ctx.getImageData(0, 0, out.width, out.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    const v = Math.max(0, Math.min(255, (g - 128) * 1.25 + 128))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(data, 0, 0)
  return out
}

// يزيل علامات الاتجاه الخفية ويجمع الأسطر في فقرة واحدة
export function cleanOcr(t: string) {
  return t
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/[|]/g, '')
    .replace(/,/g, '،')
    .replace(/;/g, '؛')
    .replace(/\?/g, '؟')
    .replace(/[.،؛]{2,}/g, '،') // علامتان متلاصقتان غالباً فاصلة واحدة قُرئت مرتين
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+([،؛:.؟!)])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export async function recognize(canvas: HTMLCanvasElement, onProgress?: (p: number, label: string) => void) {
  report = onProgress ?? null
  try {
    const w = await getWorker()
    const { data } = await w.recognize(canvas)
    return { text: cleanOcr(data.text), confidence: data.confidence }
  } finally {
    report = null
  }
}
