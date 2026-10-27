import type { Token } from './arabic'

export type Op =
  | { t: 'eq'; a: Token; b: Token; bi: number }
  | { t: 'del'; a: Token }
  | { t: 'ins'; b: Token; bi: number }

// أطول تتابع مشترك من الألفاظ مع حفظ ترتيبها، ومنه تُستخرج الزيادة والحذف
export function align(a: Token[], b: Token[]): { L: number; ops: Op[] } {
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i].key === b[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])

  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i].key === b[j].key) {
      ops.push({ t: 'eq', a: a[i], b: b[j], bi: j })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: 'del', a: a[i++] })
    } else {
      ops.push({ t: 'ins', b: b[j], bi: j })
      j++
    }
  }
  while (i < n) ops.push({ t: 'del', a: a[i++] })
  while (j < m) {
    ops.push({ t: 'ins', b: b[j], bi: j })
    j++
  }
  return { L: dp[0][0], ops }
}

export type Relation =
  | 'verbatim'
  | 'expand'
  | 'abridge'
  | 'substitute'
  | 'adapt'
  | 'influence'
  | 'independent'
  | 'first'

export const RELATIONS: Record<Relation, { label: string; strength: 0 | 1 | 2 | 3 | -1 }> = {
  verbatim: { label: 'نقل بالنص', strength: 3 },
  expand: { label: 'نقل مع زيادة قيد', strength: 3 },
  abridge: { label: 'اختصار', strength: 3 },
  substitute: { label: 'نقل مع إبدال يسير', strength: 3 },
  adapt: { label: 'نقل مع تصرف', strength: 2 },
  influence: { label: 'تأثر في الصياغة', strength: 1 },
  independent: { label: 'صياغة مستقلة', strength: 0 },
  first: { label: 'أقدم نص', strength: -1 },
}

// حدود التصنيف، ويضبطها المؤلف لكل علم
export interface Thresholds {
  verbatim: number // نقل بالنص
  cover: number // نسبة الاحتواء في زيادة القيد والاختصار
  substitute: number // إبدال يسير
  adapt: number // نقل مع تصرف
  influence: number // تأثر، وهو أدنى تشابه يُعدّ معه النص المتقدم مصدراً محتملاً
}
export const DEFAULT_TH: Thresholds = { verbatim: 0.95, cover: 0.8, substitute: 0.8, adapt: 0.6, influence: 0.3 }
export const EDGE_MIN = DEFAULT_TH.influence

export interface Comparison {
  L: number
  ops: Op[]
  sim: number // ضعف المشترك ÷ مجموع ألفاظ النصين
  covS: number // نسبة ألفاظ المصدر الموجودة في المتأخر
  covT: number // نسبة ألفاظ المتأخر المأخوذة من المصدر
  relation: Relation
}

export function classify(sim: number, covS: number, covT: number, ls: number, lt: number, th: Thresholds = DEFAULT_TH): Relation {
  if (sim >= th.verbatim) return 'verbatim'
  if (covS >= th.cover && lt > ls) return 'expand'
  if (covT >= th.cover && lt < ls) return 'abridge'
  if (sim >= th.substitute) return 'substitute'
  if (sim >= th.adapt) return 'adapt'
  if (sim >= th.influence) return 'influence'
  return 'independent'
}

export function compare(src: Token[], tgt: Token[], th: Thresholds = DEFAULT_TH): Comparison {
  const { L, ops } = align(src, tgt)
  const sim = (2 * L) / (src.length + tgt.length || 1)
  const covS = L / (src.length || 1)
  const covT = L / (tgt.length || 1)
  return { L, ops, sim, covS, covT, relation: classify(sim, covS, covT, src.length, tgt.length, th) }
}
