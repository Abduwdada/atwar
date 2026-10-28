import type { Book, Phase } from '../data/types'
import { ar, count } from './bits'

// شريط مراحل تطور العلم بنسبة امتداد كل مرحلة في الزمن
export default function PhaseBar({ phases, books, compact = false }: { phases: Phase[]; books: Book[]; compact?: boolean }) {
  if (!phases.length) return null
  const from = Math.min(...phases.map(p => p.from)), to = Math.max(...phases.map(p => p.to))
  const span = Math.max(1, to - from)
  return (
    <div className={'phasebar' + (compact ? ' compact' : '')}>
      {phases.map((p, i) => {
        const n = books.filter(b => b.death >= p.from && b.death < p.to).length
        return (
          <div key={i} className="phase" style={{ flexGrow: Math.max(0.08, (p.to - p.from) / span), ['--shade' as string]: `${22 + i * 18}%` }} title={p.note}>
            <b>{p.name}</b>
            <span className="num">{ar(p.from)}–{ar(p.to)}هـ</span>
            {!compact && <span>{count(n, 'كتاب', 'كتابان', 'كتب', 'كتاباً')}</span>}
          </div>
        )
      })}
    </div>
  )
}
