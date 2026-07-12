/**
 * JPY/KRWレート取得。フォールバックチェーン:API1 → API2 →(呼び出し側で)キャッシュ → 手動入力
 * 返り値の rate は「1円あたりのウォン(KRW per JPY)」
 */

const API1 = 'https://open.er-api.com/v6/latest/JPY'
const API2 = 'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=KRW'

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchRateFromApis(): Promise<{ rate: number; ts: number }> {
  try {
    const data = (await fetchJson(API1)) as { rates?: { KRW?: number } }
    const rate = data?.rates?.KRW
    if (typeof rate === 'number' && rate > 0) return { rate, ts: Date.now() }
    throw new Error('API1: KRWレートなし')
  } catch {
    const data = (await fetchJson(API2)) as { rates?: { KRW?: number } }
    const rate = data?.rates?.KRW
    if (typeof rate === 'number' && rate > 0) return { rate, ts: Date.now() }
    throw new Error('API2: KRWレートなし')
  }
}
