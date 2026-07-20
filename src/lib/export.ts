import { db } from './db'
import { krwToJpy } from './money'
import type { Hand, Session } from '../types'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

/** 全データJSONエクスポート(レート・取得時点を含む) */
export async function exportJson(): Promise<void> {
  const sessions = await db.sessions.toArray()
  const hands = await db.hands.toArray()
  const checkpoints = await db.checkpoints.toArray()
  const kv = await db.kv.toArray()
  download(
    `ez-baccarat_${stamp()}.json`,
    JSON.stringify({ exportedAt: new Date().toISOString(), sessions, hands, checkpoints, kv }, null, 2),
    'application/json',
  )
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** 全ハンドCSVエクスポート(₩・¥・適用レート・レート取得時点を含む) */
export async function exportCsv(): Promise<void> {
  const sessions = new Map<number, Session>()
  for (const s of await db.sessions.toArray()) if (s.id != null) sessions.set(s.id, s)
  const hands = await db.hands.orderBy('[sessionId+seq]').toArray()

  const header = [
    'セッションID',
    'セッション開始',
    'カジノ',
    'ハンド番号',
    '時刻',
    '勝者',
    '勝利合計値',
    '勝利枚数',
    '負け側合計値',
    '負け側枚数',
    'Pペア',
    'Bペア',
    'ベット内訳',
    '純損益KRW',
    '純損益JPY',
    '適用レート(KRW/JPY)',
    'レート取得時点',
  ]
  const pairText = (v: boolean | null | undefined) => (v == null ? '' : v ? 'あり' : 'なし')
  const rows = hands.map((h: Hand) => {
    const s = sessions.get(h.sessionId)
    const rate = s?.rate ?? null
    const jpy = krwToJpy(h.net, rate)
    const fmtTs = (ts: number | null | undefined) => (ts ? new Date(ts).toISOString() : '')
    return [
      String(h.sessionId),
      fmtTs(s?.startedAt),
      s?.casino ?? '',
      String(h.seq),
      fmtTs(h.ts),
      h.winner,
      h.winnerTotal == null ? '' : String(h.winnerTotal),
      h.winnerCards == null ? '' : String(h.winnerCards),
      h.loserTotal == null ? '' : String(h.loserTotal),
      h.loserCards == null ? '' : String(h.loserCards),
      pairText(h.pPair),
      pairText(h.bPair),
      h.bets.map((b) => `${b.target}:${b.amount}`).join('; ') || '見',
      String(h.net),
      jpy == null ? '' : String(Math.round(jpy)),
      rate == null ? '' : String(rate),
      fmtTs(s?.rateTs),
    ]
      .map(csvEscape)
      .join(',')
  })
  // BOM付きでExcel文字化けを防止
  download(`ez-baccarat_hands_${stamp()}.csv`, '﻿' + [header.join(','), ...rows].join('\r\n'), 'text/csv')
}
