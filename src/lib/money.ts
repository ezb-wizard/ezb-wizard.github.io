/** KRW 3桁区切り表示(例: ₩500,000) */
export function fmtKrw(n: number): string {
  const v = Math.round(n)
  const sign = v < 0 ? '-' : ''
  return `${sign}₩${Math.abs(v).toLocaleString('ja-JP')}`
}

/** KRW → JPY 換算(rate = KRW per 1 JPY)。レート不明時は null */
export function krwToJpy(krw: number, rate: number | null): number | null {
  if (rate == null || rate <= 0) return null
  return krw / rate
}

export function fmtJpy(n: number): string {
  const v = Math.round(n)
  const sign = v < 0 ? '-' : ''
  return `${sign}¥${Math.abs(v).toLocaleString('ja-JP')}`
}

/** 併記表示(例: ₩500,000(約¥53,000)) */
export function fmtBoth(krw: number, rate: number | null): string {
  const jpy = krwToJpy(krw, rate)
  return jpy == null ? fmtKrw(krw) : `${fmtKrw(krw)}(約${fmtJpy(jpy)})`
}

export function fmtPct(p: number, digits = 2): string {
  return `${(p * 100).toFixed(digits)}%`
}

/** 符号付き収支表示 */
export function fmtSigned(krw: number): string {
  return krw > 0 ? `+${fmtKrw(krw)}` : fmtKrw(krw)
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
