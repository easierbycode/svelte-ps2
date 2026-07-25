// Minimal Firebase RTDB REST client — plain fetch + EventSource (SSE), no SDK.
// KEEP IN SYNC with C:/CODE/5velte-ps2/demo/net/rtdb.ts.
import { RTDB_URL } from './protocol'

const url = (path: string) => `${RTDB_URL}/${path}.json`

export async function dbGet<T>(path: string): Promise<T | null> {
  const res = await fetch(url(path))
  if (!res.ok) return null
  return (await res.json()) as T | null
}

export async function dbPut(path: string, value: unknown): Promise<boolean> {
  const res = await fetch(url(path), { method: 'PUT', body: JSON.stringify(value) })
  return res.ok
}

export async function dbPatch(path: string, value: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(url(path), { method: 'PATCH', body: JSON.stringify(value) })
  return res.ok
}

export async function dbDelete(path: string): Promise<boolean> {
  const res = await fetch(url(path), { method: 'DELETE' })
  return res.ok
}

// Compare-and-set via ETag — used to claim the P2 seat without racing.
export async function dbPutIfMatch(path: string, value: unknown, expectCurrent: unknown): Promise<boolean> {
  const head = await fetch(url(path), { headers: { 'X-Firebase-ETag': 'true' } })
  if (!head.ok) return false
  const etag = head.headers.get('ETag')
  const current = await head.json()
  if (JSON.stringify(current) !== JSON.stringify(expectCurrent)) return false
  const res = await fetch(url(path), {
    method: 'PUT',
    headers: etag ? { 'if-match': etag } : {},
    body: JSON.stringify(value),
  })
  return res.ok
}

// SSE stream of a subtree. onValue receives the full reconstructed value on
// every server event. Returns an unsubscribe function.
export function dbStream<T>(path: string, onValue: (value: T | null) => void): () => void {
  const es = new EventSource(url(path))
  let root: unknown = null

  const setAt = (p: string, data: unknown) => {
    const parts = p.split('/').filter(Boolean)
    if (parts.length === 0) {
      root = data
      return
    }
    if (root === null || typeof root !== 'object') root = {}
    let node = root as Record<string, unknown>
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]
      if (node[key] === null || typeof node[key] !== 'object') node[key] = {}
      node = node[key] as Record<string, unknown>
    }
    const last = parts[parts.length - 1]
    if (data === null) delete node[last]
    else node[last] = data
  }

  const handle = (e: MessageEvent) => {
    try {
      const { path: p, data } = JSON.parse(e.data) as { path: string; data: unknown }
      setAt(p, data)
      onValue(root as T | null)
    } catch {
      // keep-alive or malformed frame — ignore
    }
  }

  es.addEventListener('put', handle)
  es.addEventListener('patch', (e: MessageEvent) => {
    try {
      const { path: p, data } = JSON.parse(e.data) as { path: string; data: Record<string, unknown> }
      for (const [k, v] of Object.entries(data)) setAt(`${p}/${k}`.replace(/\/+/g, '/'), v)
      onValue(root as T | null)
    } catch {
      /* ignore */
    }
  })
  return () => es.close()
}
