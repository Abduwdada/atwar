import type { Thresholds } from '../engine/compare'

export type ListKey = 'schools' | 'kinds' | 'sections'

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

export interface Book {
  id: string
  scienceId: string
  title: string
  author: string
  death: number // سنة وفاة المؤلف بالهجري، وعليها يقوم الترتيب الزمني
  deathNote?: string // مثل: وقيل ٦٩١هـ
  school?: string // المذهب
  kind?: string
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
