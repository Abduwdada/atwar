import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

// تفضيلات العرض لكل جهاز؛ ضياعها لا يضر إلا بالرجوع إلى الافتراضي
export interface Prefs {
  theme: 'system' | 'light' | 'dark'
  textSize: 'sm' | 'md' | 'lg'
  showDel: boolean // إظهار ما حذفه المتأخر من عبارة مصدره
  oldestFirst: boolean // ترتيب نصوص المسألة
}

const DEFAULTS: Prefs = { theme: 'system', textSize: 'md', showDel: true, oldestFirst: true }
const KEY = 'atwar.prefs'

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...fallback, ...JSON.parse(v) } : fallback
  } catch {
    return fallback
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* يبقى للجلسة فقط */
  }
}

const Ctx = createContext<{ prefs: Prefs; setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void } | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => read(KEY, DEFAULTS))
  const setPref = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setPrefs(p => {
      const n = { ...p, [k]: v }
      write(KEY, n)
      return n
    })
  }, [])
  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', prefs.theme)
    root.setAttribute('data-text', prefs.textSize)
  }, [prefs.theme, prefs.textSize])
  return <Ctx.Provider value={{ prefs, setPref }}>{children}</Ctx.Provider>
}

export function usePrefs() {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePrefs outside PrefsProvider')
  return c
}

// خيارات قائمة بعينها (الترتيب والتصفية والتجميع) تبقى كما تركها صاحبها
export function useListPrefs<T extends object>(name: string, defaults: T) {
  const key = `atwar.list.${name}`
  const [v, setV] = useState<T>(() => read(key, defaults))
  const set = useCallback(<K extends keyof T>(k: K, val: T[K]) => {
    setV(p => {
      const n = { ...p, [k]: val }
      write(key, n)
      return n
    })
  }, [key])
  return [v, set] as const
}
