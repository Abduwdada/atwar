import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildSample } from './seed'
import { exportScience, planImport, planSize, SHEET, type Data } from './excel'

const sample = (): Data => {
  const s = buildSample(0)
  return { science: s.science, books: s.books, issues: s.issues, passages: s.passages, authors: [] }
}
const toFile = async (b: Blob) => new File([await b.arrayBuffer()], 'x.xlsx')

describe('ملف إكسل', () => {
  it('الملف المصدَّر يُستورد دون أي تغيير', async () => {
    const d = sample()
    const plan = await planImport(await toFile(await exportScience(d)), d)
    expect(plan.errors).toEqual([])
    expect(planSize(plan)).toBe(0)
  })

  it('يضيف الكتب والنصوص الجديدة ويحدّث الموجود', async () => {
    const d = sample()
    const wb = XLSX.read(await (await exportScience(d)).arrayBuffer())
    const books = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[SHEET.books], { header: 1 })
    books.push(['', 'نهاية السول', 'جمال الدين الإسنوي', '٧٧٢', '', 'شافعي', 'شرح', ''])
    books[1][5] = 'حنفي'
    wb.Sheets[SHEET.books] = XLSX.utils.aoa_to_sheet(books)
    const ps = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[SHEET.passages], { header: 1 })
    ps.push(['', 'تعريف الواجب', 'نهاية السول', '', 'الواجب: ما يذم شرعاً تاركه قصداً مطلقاً', '١', '٥٢'])
    ps.push(['', 'تعريف المندوب', 'المحصول', '', 'المندوب: ما يمدح فاعله ولا يذم تاركه'])
    wb.Sheets[SHEET.passages] = XLSX.utils.aoa_to_sheet(ps)
    const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'x.xlsx')
    const plan = await planImport(file, d)
    expect(plan.errors).toEqual([])
    expect(plan.books.add.map(b => b.title)).toEqual(['نهاية السول'])
    expect(plan.books.add[0].death).toBe(772)
    expect(plan.books.update.length).toBe(1)
    expect(plan.issues.add.map(i => i.name)).toEqual(['تعريف المندوب'])
    expect(plan.passages.add.length).toBe(2)
    expect(plan.passages.add[0].lead).toBe('الواجب:')
    expect(plan.passages.add[0].page).toBe('٥٢')
  })

  it('يقرأ المصفوفة بهيئة الجدول المعتاد', async () => {
    const d = sample()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['الكتاب', 'المحصول', 'التحصيل'],
      ['المؤلف', '', 'سراج الدين الأرموي'],
      ['سنة الوفاة', '', 682],
      ['تعريف الواجب', 'ما يذم شرعاً تاركه قصداً مطلقاً', 'الواجب: ما يذم شرعاً تاركه قصداً'],
    ]), SHEET.matrix)
    const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'x.xlsx')
    const plan = await planImport(file, d)
    expect(plan.errors).toEqual([])
    expect(plan.books.add.map(b => b.title)).toEqual(['التحصيل'])
    expect(plan.passages.add.length).toBe(1) // نص المحصول موجود فيُتخطى
    expect(plan.skipped).toBe(1)
  })

  it('يبلّغ عن الكتاب الجديد بلا سنة وفاة', async () => {
    const d = sample()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['المعرف', 'العنوان', 'المؤلف', 'سنة الوفاة'], ['', 'كتاب مجهول', 'مؤلف', '']]), SHEET.books)
    const plan = await planImport(new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'x.xlsx'), d)
    expect(plan.errors.length).toBe(1)
    expect(plan.books.add.length).toBe(0)
  })
})
