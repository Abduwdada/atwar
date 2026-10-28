import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, datasetHash, exportAll, hasLocalWork, publishable, replaceAll, type Backup } from './db'
import { SAMPLE_SCIENCE_ID } from './seed'
import {
  ConflictError, fetchPublished, getSync, getToken, publishRemote, pullRemote, remoteSha, setSync, setToken,
  type SyncState,
} from './remote'
import type { Book, Issue, Link, Passage, Science, ScienceGroup } from './types'
import { analyseScience, type ScienceAnalysis } from '../engine/analyse'
import { DEFAULT_TH, type Thresholds } from '../engine/compare'
import { BOOK_KINDS, type ListKey } from './types'

interface Store {
  ready: boolean
  loadError: string
  // الزائر يرى البيانات المنشورة للقراءة فقط، والمؤلف يعمل على نسخته في الجهاز ثم ينشرها
  canEdit: boolean
  sciences: Science[] // بالترتيب الذي اختاره المؤلف
  groups: ScienceGroup[]
  science: Science | undefined
  setScienceId: (id: string) => void
  books: Book[] // مرتبة بسنة الوفاة
  issues: Issue[]
  passages: Passage[]
  links: Link[]
  bookById: Map<string, Book>
  issueById: Map<string, Issue>
  analysis: ScienceAnalysis
  hasSample: boolean
  thresholds: Thresholds
  lists: Record<ListKey, string[]>
  // ملخص كل علم للصفحة الرئيسية العامة
  scienceStats: Map<string, ScienceStats>
  // النشر
  sync: SyncState | null
  dirty: boolean
  localWorkHidden: boolean // نصوص على هذا الجهاز لا تظهر لأن المؤلف لم يدخل
  login: (token: string) => Promise<'pulled' | 'kept'>
  logout: () => void
  pull: () => Promise<void>
  publish: (message: string, force?: boolean) => Promise<void>
}

export interface ScienceStats { books: number; issues: number; passages: number; from?: number; to?: number; sample: boolean }

const Ctx = createContext<Store | null>(null)
const KEY = 'atwar.science'

function readSaved() {
  try {
    return localStorage.getItem(KEY) ?? SAMPLE_SCIENCE_ID
  } catch {
    return SAMPLE_SCIENCE_ID
  }
}

const sortBooks = (b: Book[]) => [...b].sort((x, y) => x.death - y.death)
export const issueKey = (i: Issue) => i.order ?? i.createdAt
const sortIssues = (i: Issue[]) => [...i].sort((x, y) => issueKey(x) - issueKey(y))

export function StoreProvider({ children }: { children: ReactNode }) {
  const [scienceId, setScienceIdState] = useState(readSaved)
  const setScienceId = useCallback((id: string) => {
    setScienceIdState(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* التفضيل يضيع فقط */
    }
  }, [])

  const [token, setTokenState] = useState(getToken)
  const [sync, setSyncState] = useState(getSync)
  const owner = !!token

  // نسخة الزائر: الملف المنشور كاملاً في الذاكرة
  const [remote, setRemote] = useState<Backup | null>(null)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    if (owner || remote) return
    fetchPublished().then(setRemote, e => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [owner, remote])

  const [localWorkHidden, setLocalWorkHidden] = useState(false)
  useEffect(() => {
    if (!owner) hasLocalWork().then(setLocalWorkHidden, () => {})
  }, [owner])

  // نسخة المؤلف: قاعدة البيانات في الجهاز (لا تُفتح للزائر)
  const lSciences = useLiveQuery(async () => (owner ? await db.sciences.orderBy('createdAt').toArray() : undefined), [owner])
  const lGroups = useLiveQuery(async () => (owner ? await db.groups.orderBy('order').toArray() : undefined), [owner])
  const lBooks = useLiveQuery(async () => (owner ? await db.books.where({ scienceId }).sortBy('death') : undefined), [owner, scienceId])
  const lIssues = useLiveQuery(async () => (owner ? await db.issues.where({ scienceId }).sortBy('createdAt') : undefined), [owner, scienceId])
  const lPassages = useLiveQuery(async () => (owner ? await db.passages.where({ scienceId }).toArray() : undefined), [owner, scienceId])
  const lLinks = useLiveQuery(async () => (owner ? await db.links.where({ scienceId }).toArray() : undefined), [owner, scienceId])
  const allLocal = useLiveQuery(async () => (owner ? { books: await db.books.toArray(), issues: await db.issues.toArray(), passages: await db.passages.toArray() } : undefined), [owner])
  const localHash = useLiveQuery(async () => (owner ? datasetHash(publishable(await exportAll())) : undefined), [owner])

  const sciences = useMemo(() => {
    const list = owner ? lSciences : remote?.sciences
    return list && [...list].sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
  }, [owner, lSciences, remote])
  const groups = useMemo(() => [...((owner ? lGroups : remote?.groups) ?? [])].sort((a, b) => a.order - b.order), [owner, lGroups, remote])
  useEffect(() => {
    if (sciences && sciences.length && !sciences.some(s => s.id === scienceId)) setScienceId(sciences[0].id)
  }, [sciences, scienceId, setScienceId])

  const login = useCallback(async (t: string) => {
    const sha = await remoteSha(t) // يتأكد أن المفتاح يصل إلى المستودع
    setToken(t)
    setTokenState(t)
    // جهاز جديد بلا عمل خاص: تُجلب النسخة المنشورة مباشرة
    if (!getSync() && !(await hasLocalWork())) {
      const { data } = await pullRemote(t)
      await replaceAll(data)
      const s = { sha, hash: datasetHash(data), at: Date.now() }
      setSync(s)
      setSyncState(s)
      return 'pulled'
    }
    return 'kept'
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setRemote(null)
  }, [])

  const pull = useCallback(async () => {
    if (!token) return
    const { data, sha } = await pullRemote(token)
    await replaceAll(data)
    const s = { sha, hash: datasetHash(data), at: Date.now() }
    setSync(s)
    setSyncState(s)
  }, [token])

  const publish = useCallback(async (message: string, force = false) => {
    if (!token) return
    const current = await remoteSha(token)
    if (!force && sync && current !== sync.sha) throw new ConflictError('نُشرت نسخة أحدث من جهاز آخر.')
    const data = publishable(await exportAll())
    const sha = await publishRemote(token, data, current, message)
    const s = { sha, hash: datasetHash(data), at: Date.now() }
    setSync(s)
    setSyncState(s)
  }, [token, sync])

  const value = useMemo<Store>(() => {
    const pick = <T extends { scienceId: string }>(xs: T[] | undefined) => (xs ?? []).filter(x => x.scienceId === scienceId)
    const books = owner ? lBooks ?? [] : sortBooks(pick(remote?.books))
    const issues = sortIssues(owner ? lIssues ?? [] : pick(remote?.issues))
    const passages = owner ? lPassages ?? [] : pick(remote?.passages)
    const links = owner ? lLinks ?? [] : pick(remote?.links)
    const sci = sciences?.find(s => s.id === scienceId)
    const thresholds = { ...DEFAULT_TH, ...sci?.thresholds }
    // القائمة كما رتبها المؤلف، مع أي قيمة مستعملة لم تدخلها بعد
    const merge = (saved: string[] | undefined, used: (string | undefined)[], base: readonly string[] = []) =>
      [...new Set([...(saved ?? base), ...used.filter((x): x is string => !!x)])]
    const lists: Record<ListKey, string[]> = {
      schools: merge(sci?.lists?.schools, books.map(b => b.school)),
      kinds: merge(sci?.lists?.kinds, books.map(b => b.kind), BOOK_KINDS),
      sections: merge(sci?.lists?.sections, issues.map(i => i.section)),
    }
    const ready = owner ? !!(lSciences && lGroups && lBooks && lIssues && lPassages && lLinks) : !!remote
    return {
      ready, loadError, canEdit: owner,
      sciences: sciences ?? [],
      groups,
      science: sciences?.find(s => s.id === scienceId),
      setScienceId,
      books, issues, passages, links,
      bookById: new Map(books.map(x => [x.id, x])),
      issueById: new Map(issues.map(x => [x.id, x])),
      analysis: analyseScience(passages, books, thresholds),
      thresholds,
      lists,
      hasSample: passages.some(x => x.sample) || books.some(x => x.sample),
      scienceStats: statsOf(owner ? allLocal : remote ?? undefined),
      sync,
      dirty: owner && !!localHash && localHash !== sync?.hash,
      localWorkHidden: !owner && localWorkHidden,
      login, logout, pull, publish,
    }
  }, [owner, remote, loadError, sciences, groups, lGroups, scienceId, setScienceId, lSciences, lBooks, lIssues, lPassages, lLinks, allLocal, localHash, sync, localWorkHidden, login, logout, pull, publish])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function statsOf(d: { books?: Book[]; issues?: Issue[]; passages?: Passage[] } | undefined) {
  const m = new Map<string, ScienceStats>()
  const get = (id: string) => m.get(id) ?? m.set(id, { books: 0, issues: 0, passages: 0, sample: false }).get(id)!
  for (const b of d?.books ?? []) {
    const s = get(b.scienceId)
    s.books++
    s.from = Math.min(s.from ?? b.death, b.death)
    s.to = Math.max(s.to ?? b.death, b.death)
  }
  for (const i of d?.issues ?? []) get(i.scienceId).issues++
  for (const p of d?.passages ?? []) {
    const s = get(p.scienceId)
    s.passages++
    if (p.sample) s.sample = true
  }
  return m
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
