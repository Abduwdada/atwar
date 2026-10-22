import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { SAMPLE_SCIENCE_ID } from './seed'
import type { Book, Issue, Link, Passage, Science } from './types'
import { analyseScience, type ScienceAnalysis } from '../engine/analyse'

interface Store {
  ready: boolean
  sciences: Science[]
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
}

const Ctx = createContext<Store | null>(null)
const KEY = 'atwar.science'

function readSaved() {
  try {
    return localStorage.getItem(KEY) ?? SAMPLE_SCIENCE_ID
  } catch {
    return SAMPLE_SCIENCE_ID
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [scienceId, setScienceIdState] = useState(readSaved)
  const setScienceId = (id: string) => {
    setScienceIdState(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* التفضيل يضيع فقط */
    }
  }

  const sciences = useLiveQuery(() => db.sciences.orderBy('createdAt').toArray(), [])
  const books = useLiveQuery(() => db.books.where({ scienceId }).sortBy('death'), [scienceId])
  const issues = useLiveQuery(() => db.issues.where({ scienceId }).sortBy('createdAt'), [scienceId])
  const passages = useLiveQuery(() => db.passages.where({ scienceId }).toArray(), [scienceId])
  const links = useLiveQuery(() => db.links.where({ scienceId }).toArray(), [scienceId])

  // إن حُذف العلم المختار يُرجع إلى أول علم موجود
  useEffect(() => {
    if (sciences && sciences.length && !sciences.some(s => s.id === scienceId)) setScienceId(sciences[0].id)
  }, [sciences, scienceId])

  const value = useMemo<Store>(() => {
    const b = books ?? []
    const p = passages ?? []
    return {
      ready: !!(sciences && books && issues && passages && links),
      sciences: sciences ?? [],
      science: sciences?.find(s => s.id === scienceId),
      setScienceId,
      books: b,
      issues: issues ?? [],
      passages: p,
      links: links ?? [],
      bookById: new Map(b.map(x => [x.id, x])),
      issueById: new Map((issues ?? []).map(x => [x.id, x])),
      analysis: analyseScience(p, b),
      hasSample: p.some(x => x.sample) || b.some(x => x.sample),
    }
  }, [sciences, scienceId, books, issues, passages, links])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
