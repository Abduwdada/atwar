import type { Book, Issue, Link, Passage, Science } from './types'

// عينة تجريبية مكتوبة من الذاكرة، وتحتاج إلى مقابلة بالطبعات المحققة
const BOOKS: [string, string, string, number, string, string, string?][] = [
  ['mutamad', 'المعتمد', 'أبو الحسين البصري', 436, 'حنفي معتزلي', 'أصل'],
  ['waraqat', 'الورقات', 'إمام الحرمين الجويني', 478, 'شافعي', 'متن'],
  ['mustasfa', 'المستصفى', 'أبو حامد الغزالي', 505, 'شافعي', 'أصل'],
  ['mahsul', 'المحصول', 'فخر الدين الرازي', 606, 'شافعي', 'أصل'],
  ['ihkam', 'الإحكام', 'سيف الدين الآمدي', 631, 'شافعي', 'أصل'],
  ['mukhtasar', 'مختصر المنتهى', 'ابن الحاجب', 646, 'مالكي', 'مختصر'],
  ['hasil', 'الحاصل', 'تاج الدين الأرموي', 653, 'شافعي', 'مختصر'],
  ['minhaj', 'منهاج الوصول', 'ناصر الدين البيضاوي', 685, 'شافعي', 'متن', 'وقيل ٦٩١هـ'],
  ['jam', 'جمع الجوامع', 'تاج الدين السبكي', 771, 'شافعي', 'متن'],
  ['irshad', 'إرشاد الفحول', 'محمد بن علي الشوكاني', 1250, 'مستقل', 'أصل'],
]

const ISSUES: [string, string, string][] = [
  ['usul', 'تعريف أصول الفقه', 'المقدمات'],
  ['hukm', 'تعريف الحكم الشرعي', 'الحكم الشرعي'],
  ['wajib', 'تعريف الواجب', 'الحكم التكليفي'],
]

// ما قبل العلامة | هو اللفظ المعرَّف
const PASSAGES: [string, string, string][] = [
  ['usul', 'mutamad', 'أصول الفقه هي|طرق الفقه على طريق الإجمال، وكيفية الاستدلال بها، وما يتبع كيفية الاستدلال بها'],
  ['usul', 'waraqat', 'وأصول الفقه:|طرقه على سبيل الإجمال، وكيفية الاستدلال بها'],
  ['usul', 'mustasfa', 'أصول الفقه عبارة عن|أدلة هذه الأحكام، وعن معرفة وجوه دلالتها على الأحكام من حيث الجملة لا من حيث التفصيل'],
  ['usul', 'mahsul', 'أصول الفقه عبارة عن|مجموع طرق الفقه على سبيل الإجمال، وكيفية الاستدلال بها، وكيفية حال المستدل بها'],
  ['usul', 'ihkam', 'أصول الفقه هي|أدلة الفقه، وجهات دلالاتها على الأحكام الشرعية، وكيفية حال المستدل بها من جهة الجملة لا من جهة التفصيل'],
  ['usul', 'mukhtasar', 'أصول الفقه:|العلم بالقواعد التي يتوصل بها إلى استنباط الأحكام الشرعية الفرعية عن أدلتها التفصيلية'],
  ['usul', 'minhaj', 'أصول الفقه:|معرفة دلائل الفقه إجمالاً، وكيفية الاستفادة منها، وحال المستفيد'],
  ['usul', 'jam', 'أصول الفقه:|دلائل الفقه الإجمالية، وقيل: معرفتها'],
  ['usul', 'irshad', 'أصول الفقه:|إدراك القواعد التي يتوصل بها إلى استنباط الأحكام الشرعية الفرعية عن أدلتها التفصيلية'],
  ['hukm', 'mustasfa', 'الحكم عندنا عبارة عن|خطاب الشرع إذا تعلق بأفعال المكلفين'],
  ['hukm', 'mahsul', 'الحكم:|الخطاب المتعلق بأفعال المكلفين بالاقتضاء أو التخيير'],
  ['hukm', 'ihkam', 'الحكم الشرعي عبارة عن|خطاب الشارع المفيد فائدة شرعية'],
  ['hukm', 'mukhtasar', 'الحكم:|خطاب الله تعالى المتعلق بأفعال المكلفين بالاقتضاء أو التخيير أو الوضع'],
  ['hukm', 'minhaj', 'الحكم:|خطاب الله تعالى المتعلق بأفعال المكلفين بالاقتضاء أو التخيير'],
  ['hukm', 'jam', 'الحكم:|خطاب الله المتعلق بفعل المكلف من حيث إنه مكلف'],
  ['wajib', 'waraqat', 'فالواجب:|ما يثاب على فعله ويعاقب على تركه'],
  ['wajib', 'mustasfa', 'الواجب هو|الذي يذم تاركه ويلام شرعاً بوجه ما'],
  ['wajib', 'mahsul', 'الواجب:|ما يذم شرعاً تاركه قصداً مطلقاً'],
  ['wajib', 'ihkam', 'الواجب:|ما ينتهض تركه سبباً للذم شرعاً في حالة ما'],
  ['wajib', 'mukhtasar', 'الواجب:|ما يذم تاركه شرعاً بوجه ما'],
  ['wajib', 'minhaj', 'الواجب:|ما يذم شرعاً تاركه قصداً مطلقاً'],
]

const IBN_KHALDUN = 'ذكر ابن خلدون أن المحصول والإحكام جمعا ما في كتب المتكلمين الأربعة، ومنها المعتمد والمستصفى'
const SUBKI = 'ذكر السبكي أن عمدته شرحاه على المختصر والمنهاج مع زيادات من نحو مئة مصنف'
const LINKS: [string, string, string][] = [
  ['mutamad', 'mahsul', IBN_KHALDUN],
  ['mustasfa', 'mahsul', IBN_KHALDUN],
  ['mutamad', 'ihkam', IBN_KHALDUN],
  ['mustasfa', 'ihkam', IBN_KHALDUN],
  ['mahsul', 'hasil', 'الحاصل اختصار للمحصول'],
  ['hasil', 'minhaj', 'بنى البيضاوي المنهاج على الحاصل'],
  ['ihkam', 'mukhtasar', 'اختصر ابن الحاجب الإحكام في منتهى السول، ثم اختصر المنتهى في هذا المختصر'],
  ['mukhtasar', 'jam', SUBKI],
  ['minhaj', 'jam', SUBKI],
]

export const SAMPLE_SCIENCE_ID = 'usul'

export function buildSample(now = Date.now()) {
  const sid = SAMPLE_SCIENCE_ID
  const id = (k: string) => `sample-${k}`
  const science: Science = { id: sid, name: 'أصول الفقه', createdAt: now }
  const books: Book[] = BOOKS.map(([k, title, author, death, school, kind, deathNote]) => ({
    id: id(k), scienceId: sid, title, author, death, school, kind, deathNote, sample: true, createdAt: now,
  }))
  const issues: Issue[] = ISSUES.map(([k, name, section], i) => ({
    id: id(k), scienceId: sid, name, section, sample: true, createdAt: now + i,
  }))
  const passages: Passage[] = PASSAGES.map(([iss, book, text], i) => {
    const [lead, body] = text.split('|')
    return {
      id: id(`${iss}-${book}`), scienceId: sid, issueId: id(iss), bookId: id(book),
      lead: lead.trim(), body: body.trim(), sample: true, createdAt: now + i, updatedAt: now + i,
    }
  })
  const links: Link[] = LINKS.map(([from, to, note], i) => ({
    id: id(`link-${i}`), scienceId: sid, from: id(from), to: id(to), note, sample: true, createdAt: now,
  }))
  return { science, books, issues, passages, links }
}
