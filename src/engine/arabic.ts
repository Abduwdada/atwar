// توحيد الرسم العربي للمقارنة فقط؛ النص المعروض يبقى كما كتبه المصنف

export interface Token {
  raw: string // اللفظ كما ورد في النص
  key: string // صورته الموحدة المستعملة في المقارنة
}

export function normalize(word: string): string {
  return word
    .replace(/ًا|اً/g, '') // تنوين الفتح مع ألفه: «شرعاً» = «شرع»
    .replace(/[ً-ٰٟـ]/g, '') // الحركات والتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^ء-ي]/g, '')
}

// يجرد السوابق (و، ف، ب، ل، ك، ال) وبعض اللواحق، بشرط أن يبقى من اللفظ ما يكفي لتمييزه
export function core(word: string): string {
  let k = word
  if (k.startsWith('لل') && k.length > 3) {
    k = k.slice(2)
  } else {
    const prefix = k.match(/^(?:[وف])?(?:[بلك])?(?:ال)?/)![0]
    if (prefix && k.length - prefix.length >= 3) k = k.slice(prefix.length)
  }
  if (k.length >= 4 && k.endsWith('ا')) k = k.slice(0, -1)
  if (k.length >= 4 && k.endsWith('ه')) k = k.slice(0, -1)
  return k
}

export function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(raw => {
      const n = normalize(raw)
      return { raw, key: n ? core(n) : '' }
    })
    .filter(t => t.key)
}

// يفصل اللفظ المعرَّف عن التعريف إذا جاء قبل نقطتين في أول النص، مثل «الواجب: ما يذم...»
export function splitLead(text: string): { lead: string; body: string } {
  const t = text.trim()
  const i = t.indexOf(':')
  if (i > 0 && t.slice(0, i).split(/\s+/).length <= 5) {
    return { lead: t.slice(0, i + 1).trim(), body: t.slice(i + 1).trim() }
  }
  return { lead: '', body: t }
}

export function stripPunct(s: string): string {
  return s.replace(/[،؛:.,؟?!«»"()[\]]/g, '')
}
