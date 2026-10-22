import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Op } from '../engine/compare'
import { RELATIONS, type Relation } from '../engine/compare'
import type { Book } from '../data/types'
import * as Icon from './icons'

const DIG = '٠١٢٣٤٥٦٧٨٩'
export const ar = (n: number | string) => String(n).replace(/\d/g, d => DIG[+d])
export const pct = (x: number) => ar(Math.round(x * 100)) + '٪'
export const yr = (b: Book) => `ت ${ar(b.death)}هـ`

// عدد مع تمييزه: كتاب واحد، كتابان، ٣ كتب، ١١ كتاباً
export function count(n: number, one: string, two: string, few: string, many: string) {
  if (n === 0) return `لا ${one}`
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${ar(n)} ${few}`
  return `${ar(n)} ${many}`
}

export function Badge({ relation, manual }: { relation: Relation; manual?: boolean }) {
  const r = RELATIONS[relation]
  const s = r.strength < 0 ? 'f' : String(r.strength)
  return (
    <span className="row" style={{ display: 'inline-flex', gap: 6, flex: 'none' }}>
      <span className={`badge s${s}`}>{r.label}</span>
      {manual && <span className="badge mine">بتحديدك</span>}
    </span>
  )
}

export function DiffText({ ops, novel, showDel = true }: { ops: Op[]; novel: Set<string>; showDel?: boolean }) {
  const parts: ReactNode[] = []
  ops.forEach((o, i) => {
    if (o.t === 'eq') parts.push(o.b.raw)
    else if (o.t === 'ins')
      parts.push(novel.has(o.b.key)
        ? <ins key={i} className="nv" title="لفظ لم يرد في نص أقدم">{o.b.raw}</ins>
        : <ins key={i} title="زيادة على المصدر">{o.b.raw}</ins>)
    else if (showDel) parts.push(<del key={i} title="محذوف من المصدر">{o.a.raw}</del>)
  })
  return <>{parts.flatMap((p, i) => (i ? [' ', p] : [p]))}</>
}

export function PageHead({ title, sub, back, action }: { title: ReactNode; sub?: ReactNode; back?: string; action?: ReactNode }) {
  return (
    <div className="stack tight">
      {back && <Link className="back" to={back}><Icon.Back />رجوع</Link>}
      <div className="page-head">
        <h1>{title}{sub && <span className="sub">{sub}</span>}</h1>
        {action}
      </div>
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(''), 2200)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? <div className="toast" role="status">{msg}</div> : null
  return [node, useCallback((m: string) => setMsg(m), [])] as const
}

// زر حذف بخطوة تأكيد داخل الصفحة نفسها
export function ConfirmButton({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)
  if (!asking)
    return <button className="btn sm ghost danger" onClick={() => setAsking(true)}><Icon.Trash />{label}</button>
  return (
    <span className="row" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <span className="small">{confirm}</span>
      <button className="btn sm danger" onClick={onConfirm}>نعم</button>
      <button className="btn sm" onClick={() => setAsking(false)}>تراجع</button>
    </span>
  )
}
