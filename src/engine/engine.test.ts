import { describe, expect, it } from 'vitest'
import { core, normalize, splitLead, tokenize } from './arabic'
import { compare } from './compare'
import { analyseScience } from './analyse'
import { buildSample } from '../data/seed'

const cmp = (a: string, b: string) => compare(tokenize(a), tokenize(b))

describe('توحيد الرسم', () => {
  it('يحذف الحركات وتنوين الفتح ويوحد الهمزات', () => {
    expect(normalize('شرعاً')).toBe('شرع')
    expect(normalize('إجمالاً')).toBe('اجمال')
    expect(normalize('الأحكامُ')).toBe('الاحكام')
  })
  it('يجرد السوابق دون أن يفسد الألفاظ القصيرة', () => {
    expect(core('وكيفيه')).toBe(core('كيفيه'))
    expect(core('بالاقتضاء')).toBe(core('الاقتضاء'))
    expect(core('للذم')).toBe('ذم')
    expect(core('بها')).toBe('بها')
    expect(core('فقه')).toBe('فقه')
  })
  it('يفصل اللفظ المعرَّف عن التعريف', () => {
    expect(splitLead('الواجب: ما يذم شرعاً تاركه')).toEqual({ lead: 'الواجب:', body: 'ما يذم شرعاً تاركه' })
    expect(splitLead('ما يذم شرعاً تاركه').lead).toBe('')
  })
})

describe('تصنيف العلاقة', () => {
  it('النص المطابق نقل بالنص', () => {
    expect(cmp('ما يذم شرعاً تاركه قصداً مطلقاً', 'ما يذم شرعاً تاركه قصداً مطلقاً').relation).toBe('verbatim')
  })
  it('زيادة قيد على المصدر', () => {
    const r = cmp('الخطاب المتعلق بأفعال المكلفين بالاقتضاء أو التخيير', 'خطاب الله تعالى المتعلق بأفعال المكلفين بالاقتضاء أو التخيير أو الوضع')
    expect(r.relation).toBe('expand')
  })
  it('اختصار عبارة المصدر', () => {
    expect(cmp('الذي يذم تاركه ويلام شرعاً بوجه ما', 'ما يذم تاركه شرعاً بوجه ما').relation).toBe('abridge')
  })
  it('إبدال لفظ واحد', () => {
    const a = 'العلم بالقواعد التي يتوصل بها إلى استنباط الأحكام الشرعية الفرعية عن أدلتها التفصيلية'
    const b = 'إدراك القواعد التي يتوصل بها إلى استنباط الأحكام الشرعية الفرعية عن أدلتها التفصيلية'
    expect(cmp(a, b).relation).toBe('substitute')
  })
  it('صياغة مستقلة', () => {
    expect(cmp('ما يثاب على فعله ويعاقب على تركه', 'خطاب الشارع المفيد فائدة شرعية').relation).toBe('independent')
  })
})

describe('تحليل العينة', () => {
  const s = buildSample(0)
  const a = analyseScience(s.passages, s.books)
  const get = (k: string) => a.passages.get(`sample-${k}`)!

  it('يجد أقرب مصدر سابق', () => {
    expect(get('wajib-minhaj').source?.book.title).toBe('المحصول')
    expect(get('usul-irshad').source?.book.title).toBe('مختصر المنتهى')
  })
  it('يكشف المصدر الثاني في التعريف المركب', () => {
    expect(get('usul-ihkam').second?.book.title).toBe('المحصول')
  })
  it('أقدم نص في المسألة لا مصدر له', () => {
    expect(get('usul-mutamad').relation).toBe('first')
  })
  it('يحترم المصدر الذي يحدده الباحث', () => {
    const passages = s.passages.map(p =>
      p.id === 'sample-hukm-minhaj' ? { ...p, source: { mode: 'manual' as const, passageId: 'sample-hukm-mahsul' } } : p)
    const b = analyseScience(passages, s.books)
    expect(b.passages.get('sample-hukm-minhaj')!.source?.book.title).toBe('المحصول')
    expect(b.passages.get('sample-hukm-minhaj')!.manual).toBe(true)
  })
  it('يستخرج أصل الكتاب ورأس عائلته', () => {
    expect(a.parent.get('sample-minhaj')?.from).toBe('sample-mahsul')
    expect(a.rootOf('sample-waraqat')).toBe('sample-mutamad')
  })
})

describe('اقتراح مراحل التطور', () => {
  it('يقترح ثلاث مراحل متتالية على الأقل من العينة', async () => {
    const { suggestPhases } = await import('./phases')
    const s = buildSample(0)
    const a = analyseScience(s.passages, s.books)
    const { phases } = suggestPhases(s.books, [...a.passages.values()])
    expect(phases.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < phases.length; i++) expect(phases[i].from).toBe(phases[i - 1].to)
    expect(phases[0].from).toBe(436)
  })
  it('يرفض الاقتراح مع قلة الكتب', async () => {
    const { suggestPhases } = await import('./phases')
    expect(suggestPhases(buildSample(0).books.slice(0, 2)).phases).toEqual([])
  })
})
