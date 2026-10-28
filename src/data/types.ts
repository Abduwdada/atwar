import type { Thresholds } from '../engine/compare'

export type ListKey = 'schools' | 'kinds' | 'sections' | 'methods'

// مجموعة علوم، مثل علوم الآلة وعلوم الغاية
export interface ScienceGroup {
  id: string
  name: string
  order: number
  createdAt: number
}

export interface Science {
  id: string
  name: string
  description?: string
  groupId?: string
  order?: number // ترتيبه في القوائم، وإلا فبحسب وقت الإضافة
  hidden?: boolean // مخفي عن الزوار: لا يدخل في النسخة المنشورة
  // طريقة الرصد: نصوص المسائل وتطورها، أو الكتب ومناهج التأليف فيها كالحديث والتفسير
  mode?: 'issues' | 'books'
  phases?: Phase[]
  // مواضع الكتب في الشجرة كما رتبها المؤلف بالسحب، لكل طريقة عرض على حدة
  treeLayout?: Record<string, { x: number; y: number }> // العمودي (الصيغة الأولى)
  treeLayoutH?: Record<string, { x: number; y: number }> // الأفقي
  // انحناء كل سهم: إزاحة نقطة وسطه عن الخط المستقيم بين الكتابين
  treeBends?: Record<string, { x: number; y: number }>
  treeBendsH?: Record<string, { x: number; y: number }>
  // القوائم التي يختار منها المؤلف عند الإضافة، ويعدّلها من إعدادات العلم
  lists?: Partial<Record<ListKey, string[]>>
  thresholds?: Partial<Thresholds>
  createdAt: number
}

export const BOOK_KINDS = ['أصل', 'متن', 'شرح', 'حاشية', 'مختصر', 'نظم', 'تقريرات'] as const

// مرحلة من مراحل تطور العلم، كالنشأة والتكوين ثم التطور والتوسع ثم التمكن والنضج
export interface Phase {
  name: string
  from: number
  to: number
  note?: string
}

// المؤلف في سجل واحد لكل العلوم، فتُجمع كتبه في كل علم صنّف فيه
export interface Author {
  id: string
  name: string
  death?: number
  bio?: string
  createdAt: number
}

export const XLINK_TYPES = {
  method: 'انتقال منهج',
  term: 'نقل مصطلح',
  school: 'تتلمذ واستمداد',
  critique: 'رد ونقد',
  other: 'صلة أخرى',
} as const
export type XLinkType = keyof typeof XLINK_TYPES

// صلة بين كتابين من علمين مختلفين: الأول أثّر في الثاني
export interface XLink {
  id: string
  from: string
  to: string
  type: XLinkType
  note: string
  createdAt: number
}

export interface Book {
  id: string
  scienceId: string
  title: string
  author: string // اسم المؤلف كما يظهر، ويُربط بسجل المؤلفين عبر authorId
  authorId?: string
  death: number // سنة وفاة المؤلف بالهجري، وعليها يقوم الترتيب الزمني
  deathNote?: string // مثل: وقيل ٦٩١هـ
  school?: string // المذهب
  kind?: string
  method?: string // طريقة التأليف، كالمسند والسنن والجامع
  sample?: boolean
  createdAt: number
}

export interface Issue {
  id: string
  scienceId: string
  name: string
  section?: string // الباب الذي تندرج تحته المسألة
  order?: number // ترتيب يحدده المؤلف، وإلا فبحسب وقت الإضافة
  sample?: boolean
  createdAt: number
}

export interface Passage {
  id: string
  scienceId: string
  issueId: string
  bookId: string
  lead: string // اللفظ المعرَّف، ولا يدخل في المقارنة
  body: string
  volume?: string
  page?: string
  edition?: string
  note?: string
  // مصدر يحدده الباحث بنفسه بدل المصدر الذي يقترحه النظام
  source?: { mode: 'manual'; passageId: string } | { mode: 'none' }
  confirmed?: boolean
  sample?: boolean
  createdAt: number
  updatedAt: number
}

// صلة معلنة بين كتابين: شرح أو اختصار أو نص في مقدمة أو ترجمة
export interface Link {
  id: string
  scienceId: string
  from: string
  to: string
  note: string
  sample?: boolean
  createdAt: number
}
