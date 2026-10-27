export interface Science {
  id: string
  name: string
  description?: string
  // مواضع الكتب في الشجرة كما رتبها المؤلف بالسحب
  treeLayout?: Record<string, { x: number; y: number }>
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
