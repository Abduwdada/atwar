import type { Book, Phase } from '../data/types'
import type { PassageAnalysis } from './analyse'
import type { Relation } from './compare'

// اقتراح مراحل تطور العلم من بياناته؛ يراجعه الباحث ويعدّله قبل اعتماده
export const PHASE_NAMES = ['النشأة والتكوين', 'التطور والتوسع', 'التمكن والنضج', 'الشروح والحواشي'] as const

const COMMENTARY = new Set(['شرح', 'حاشية', 'مختصر', 'تقريرات', 'نظم'])
const COPY: Relation[] = ['verbatim', 'expand', 'abridge', 'substitute']

export interface Suggestion {
  phases: Phase[]
  reason?: string // سبب تعذر الاقتراح
}

const at = (years: number[], p: number) => years[Math.min(years.length - 1, Math.max(0, Math.round(p * (years.length - 1))))]

export function suggestPhases(books: Book[], passages: PassageAnalysis[] = []): Suggestion {
  const sorted = [...books].sort((a, b) => a.death - b.death)
  if (sorted.length < 3) return { phases: [], reason: 'يحتاج الاقتراح ثلاثة كتب على الأقل بسنوات وفاة مؤلفيها.' }
  const years = sorted.map(b => b.death)
  const start = years[0], end = years.at(-1)!
  const notes: string[] = []

  // الشروح والحواشي: أول قرن يغلب فيه الشرح والاختصار والحاشية على التأليف
  let comment: number | undefined
  const centuries = [...new Set(years.map(y => Math.floor(y / 100)))]
  for (const c of centuries) {
    const inC = sorted.filter(b => Math.floor(b.death / 100) === c)
    const share = inC.filter(b => b.kind && COMMENTARY.has(b.kind)).length / inC.length
    if (inC.length >= 2 && share >= 0.5 && c * 100 > at(years, 0.5)) { comment = c * 100; break }
  }

  // النضج في علوم المسائل: حين يصير أكثر النصوص منقولاً بالنص أو بزيادة قيد، أي استقرت الصياغة
  let mature: number | undefined
  let matureWhy = ''
  const judged = passages.filter(a => a.relation !== 'first').sort((a, b) => a.book.death - b.book.death)
  if (judged.length >= 6) {
    const w = 5
    for (let i = w - 1; i < judged.length; i++) {
      const win = judged.slice(i - w + 1, i + 1)
      if (win.filter(a => COPY.includes(a.relation)).length / w >= 0.6) {
        mature = judged[i - w + 1].book.death
        matureWhy = 'صار أكثر النصوص منقولاً بالنص أو بزيادة قيد أو باختصار، أي استقرت الصياغة'
        break
      }
    }
  }
  // النضج في علوم الكتب: حين تكتمل مناهج التأليف فلا يظهر منهج جديد
  if (mature === undefined) {
    const firstOf = new Map<string, number>()
    sorted.forEach(b => { if (b.method && !firstOf.has(b.method)) firstOf.set(b.method, b.death) })
    if (firstOf.size >= 3) {
      mature = Math.max(...firstOf.values())
      matureWhy = 'اكتملت مناهج التأليف، فلم يظهر بعدها منهج جديد'
    }
  }
  if (mature === undefined) { mature = at(years, 0.6); matureWhy = 'تقدير بحسب توزيع الكتب على الزمن' ; notes.push('تقديري') }

  let expand = at(years, 0.25)
  const limit = comment ?? end + 1
  if (mature >= limit) mature = at(years, 0.6) < limit ? at(years, 0.6) : Math.round((expand + limit) / 2)
  if (expand <= start) expand = sorted.find(b => b.death > start)?.death ?? start + 1
  if (expand >= mature) expand = Math.round((start + mature) / 2)

  const phases: Phase[] = [
    { name: PHASE_NAMES[0], from: start, to: expand, note: `من أول كتاب مرصود: ${sorted[0].title}` },
    { name: PHASE_NAMES[1], from: expand, to: mature, note: 'تكاثر التصنيف وتنوعت الصياغات والمناهج' },
    { name: PHASE_NAMES[2], from: mature, to: comment ?? end + 1, note: matureWhy },
  ]
  if (comment !== undefined) phases.push({ name: PHASE_NAMES[3], from: comment, to: end + 1, note: 'غلبت الشروح والحواشي والمختصرات على التأليف' })
  return { phases: phases.filter(p => p.to > p.from) }
}

export const phaseOf = (phases: Phase[] | undefined, year: number) =>
  phases?.find(p => year >= p.from && year < p.to)
