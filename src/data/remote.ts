import type { Backup } from './db'

// البيانات المنشورة ملف واحد في مستودع عام، يقرؤه الزوار ويحدّثه المؤلف وحده بمفتاحه
export const DATA_REPO = { owner: 'Abduwdada', repo: 'atwar-data', path: 'atwar.json', branch: 'main' }
const { owner, repo, path, branch } = DATA_REPO
export const PUBLIC_URL = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
const API = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
export const HISTORY_URL = `https://github.com/${owner}/${repo}/commits/${branch}/${path}`

const TOKEN_KEY = 'atwar.token'
const SYNC_KEY = 'atwar.sync'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* المتصفح يمنع الحفظ: يبقى الدخول لهذه الجلسة فقط */
  }
}

// آخر نسخة نُشرت أو جُلبت على هذا الجهاز، وبها نعرف هل في تعديلات لم تُنشر
export interface SyncState { sha: string; hash: string; at: number }
export function getSync(): SyncState | null {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null')
  } catch {
    return null
  }
}
export function setSync(s: SyncState | null) {
  try {
    if (s) localStorage.setItem(SYNC_KEY, JSON.stringify(s))
    else localStorage.removeItem(SYNC_KEY)
  } catch {
    /* لا شيء */
  }
}

export async function fetchPublished(): Promise<Backup> {
  const r = await fetch(PUBLIC_URL, { cache: 'no-cache' })
  if (!r.ok) throw new Error('تعذر تحميل البيانات المنشورة.')
  return r.json()
}

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

export class AuthError extends Error {}
export class ConflictError extends Error {}

async function check(r: Response) {
  if (r.status === 401 || r.status === 403) throw new AuthError('المفتاح غير صالح أو لا يملك صلاحية الكتابة على مستودع البيانات.')
  if (r.status === 404) throw new AuthError('المفتاح لا يصل إلى مستودع البيانات. تأكد أنك اخترت المستودع atwar-data عند إنشائه.')
  if (r.status === 409 || r.status === 422) throw new ConflictError('نُشرت نسخة أحدث من جهاز آخر.')
  if (!r.ok) throw new Error('تعذر الاتصال بـ GitHub. حاول مرة أخرى.')
  return r
}

export async function pullRemote(token: string): Promise<{ data: Backup; sha: string }> {
  const meta = await check(await fetch(`${API}?ref=${branch}&t=${Date.now()}`, { headers: headers(token), cache: 'no-store' }))
  const { sha } = await meta.json()
  const raw = await check(await fetch(`${API}?ref=${branch}&t=${Date.now()}`, {
    headers: { ...headers(token), Accept: 'application/vnd.github.raw+json' }, cache: 'no-store',
  }))
  return { data: await raw.json(), sha }
}

export async function remoteSha(token: string): Promise<string> {
  const r = await check(await fetch(`${API}?ref=${branch}&t=${Date.now()}`, { headers: headers(token), cache: 'no-store' }))
  return (await r.json()).sha
}

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function publishRemote(token: string, data: Backup, sha: string, message: string): Promise<string> {
  const r = await check(await fetch(API, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ message, content: toBase64(JSON.stringify(data, null, 1)), sha, branch }),
  }))
  return (await r.json()).content.sha
}
