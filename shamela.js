// جامع الشاملة: يعمل في صفحة كتاب على shamela.ws بزر في شريط المفضلة، فيجمع بطاقة الكتاب وفهرسه ونصه صفحةً صفحة
// ويحفظها ملفاً يُستورد في أطوار. لا يُرسل شيئاً إلى أي مكان، ويطلب الصفحات واحدة بعد أخرى بتمهل رفقاً بالموقع.
// وتُترك مقدمة التحقيق والفهارس الملحقة، فليست من كلام المؤلف
;(async () => {
  if (window.__atwarShamela) return
  window.__atwarShamela = true
  const m = location.pathname.match(/\/book\/(\d+)/)
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;z-index:99999;top:16px;left:16px;width:340px;background:#fff;color:#1d2a26;border:1px solid #cfd8d3;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:16px;font:15px/1.7 system-ui,sans-serif;direction:rtl;text-align:right'
  document.body.appendChild(box)
  const say = (html) => { box.innerHTML = '<b style="color:#1f6b5a">أطوار · جامع الشاملة</b><div style="margin-top:6px">' + html + '</div>' }
  const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'margin:10px 0 0 8px;padding:6px 14px;border-radius:999px;border:1px solid #1f6b5a;background:#1f6b5a;color:#fff;font:inherit;cursor:pointer'; b.onclick = fn; box.appendChild(b); return b }
  const close = () => { box.remove(); window.__atwarShamela = false }
  if (!m) { say('افتح صفحة كتاب في المكتبة الشاملة أولاً، ثم اضغط الزر.'); btn('إغلاق', close); return }
  const id = m[1]
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const get = async (url) => { for (let t = 0; ; t++) { try { const r = await fetch(url, { credentials: 'same-origin' }); if (r.ok) return await r.text(); if (t > 3) throw new Error(r.status) } catch (e) { if (t > 3) throw e } await sleep(1500 * (t + 1)) } }
  const doc = (html) => new DOMParser().parseFromString(html, 'text/html')
  const clean = (s) => s.replace(/\s+/g, ' ').trim()
  const SKIP = /مقدمة (?:التحقيق|المحقق|الدراسة)|قسم (?:الدراسة|التحقيق)|^الدراسة|^(?:ال)?فهارس|^فهرس|ثبت المصادر|المصادر والمراجع|قائمة المصادر/

  try {
    say('يُقرأ فهرس الكتاب…')
    const home = doc(await get('/book/' + id))
    const info = home.querySelector('.betaka-index')
    const cardText = (info ? (info.innerText || info.textContent) : '').split('فهرس الموضوعات')[0].trim()
    const title = (home.title || '').replace(/ - المكتبة الشاملة.*$/, '')

    // الفهرس بفروعه: ما له [+] تُطلب فروعه من الموقع
    const toc = []
    const walk = async (ul, depth) => {
      for (const li of [...ul.children].filter(x => x.tagName === 'LI')) {
        const a = [...li.querySelectorAll(':scope > a')].find(x => /\/book\/\d+\/\d+/.test(x.getAttribute('href') || ''))
        if (!a) continue
        const t = clean(a.textContent), page = +a.getAttribute('href').match(/\/book\/\d+\/(\d+)/)[1]
        const item = { title: t, page, depth, skip: SKIP.test(t) }
        toc.push(item)
        const exp = li.querySelector(':scope > .exp_bu')
        let sub = li.querySelector(':scope > ul')
        if (!sub && exp && !item.skip) { sub = doc('<ul>' + (await get('/ajax/titlechilds/' + id + '/' + exp.getAttribute('data-id'))) + '</ul>').querySelector('ul'); await sleep(250) }
        if (sub) { const from = toc.length; await walk(sub, depth + 1); if (item.skip) for (let i = from; i < toc.length; i++) toc[i].skip = true }
      }
    }
    const top = info && info.querySelector('ul')
    if (!top) throw new Error('لم يوجد فهرس الموضوعات في صفحة الكتاب')
    await walk(top, 0)
    const lastLink = [...home.querySelectorAll('a')].find(a => a.textContent.trim() === '>>')
    const last = lastLink ? +lastLink.getAttribute('href').match(/\/book\/\d+\/(\d+)/)[1] : Math.max(...toc.map(t => t.page))

    // الصفحات المطلوبة: من أول عنوان غير متروك إلى آخر الكتاب، إلا ما وقع في مدى عنوان متروك
    const kept = toc.filter(t => !t.skip)
    if (!kept.length) throw new Error('كل عناوين الفهرس متروكة')
    const sorted = [...toc].sort((a, b) => a.page - b.page)
    const want = []
    for (let p = kept[0].page; p <= last; p++) {
      const owner = [...sorted].reverse().find(t => t.page <= p)
      if (!owner || !owner.skip || kept.some(k => k.page === p)) want.push(p)
    }
    let stop = false
    const pages = []
    const started = Date.now()
    say('يُجمع النص…')
    const bar = document.createElement('div'); box.appendChild(bar)
    btn('إيقاف وحفظ ما جُمع', () => { stop = true })
    for (let i = 0; i < want.length && !stop; i++) {
      const d = doc(await get('/book/' + id + '/' + want[i]))
      const tm = (d.title || '').match(/(?:ج(\d+)\s*-\s*)?ص(\d+)/)
      const nass = d.querySelector('.nass')
      const paras = [], notes = []
      let inNotes = false
      for (const el of nass ? [...nass.children] : []) {
        el.querySelectorAll('.btn_tag').forEach(x => x.remove())
        const t = clean(el.textContent)
        if (!t) continue
        if (/hamesh/.test(el.className) || /^_{5,}/.test(t)) { inNotes = true; const rest = t.replace(/^_{5,}/, '').trim(); if (rest) notes.push(rest); continue }
        ;(inNotes ? notes : paras).push(t)
      }
      pages.push({ id: want[i], vol: tm && tm[1] ? +tm[1] : undefined, page: tm ? +tm[2] : undefined, paras, notes })
      const left = Math.round(((Date.now() - started) / (i + 1)) * (want.length - i - 1) / 60000)
      bar.innerHTML = 'الصفحة ' + (i + 1) + ' من ' + want.length + (left > 0 ? ' · بقي نحو ' + left + ' دقيقة' : '') + '<div style="height:6px;background:#e8eeeb;border-radius:3px;margin-top:6px"><div style="height:6px;border-radius:3px;background:#1f6b5a;width:' + Math.round(((i + 1) / want.length) * 100) + '%"></div></div>'
      await sleep(200)
    }

    const data = { atwar: 'shamela', v: 1, bookId: +id, url: location.origin + '/book/' + id, title, card: cardText, toc, pages, complete: !stop }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'shamela-' + id + '.json'
    document.body.appendChild(a); a.click(); a.remove()
    say('جُمع ' + pages.length + ' صفحة' + (stop ? ' (أوقفته قبل آخره)' : '') + '، وحُفظ الملف <b dir="ltr">shamela-' + id + '.json</b> في التنزيلات.<br>افتح الكتاب في أطوار، ثم «إضافة المسائل من فهرس الكتاب»، ثم «كتاب من الشاملة»، واختر الملف.')
    btn('إغلاق', close)
  } catch (e) {
    say('تعذر الجمع: ' + (e && e.message ? e.message : e))
    btn('إغلاق', close)
  }
})()
