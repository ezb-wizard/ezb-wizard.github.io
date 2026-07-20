import type { HandInput, SideBetDef, Winner } from '../types'

/** サイドベット定義から導出した1タップ結果ボタン(例: D7=バンカー3枚合計7勝ち) */
export interface QuickOutcome {
  id: string
  /** ボタン表示用の短縮ラベル */
  short: string
  name: string
  side: Winner
  input: HandInput
}

const SHORT_NAMES: Record<string, string> = {
  D7: 'D7',
  B6: 'B6',
  P7: 'P7',
  PANDA8: 'P8',
  SMALL_DRAGON: 'SD',
  BIG_DRAGON: 'BD',
  SMALL_TIGER: 'ST',
  BIG_TIGER: 'BT',
}

/**
 * 「単一の勝利合計値」で決まるサイドベットだけを1タップボタン化する。
 * (Dragon Tigerのように負け側情報が要るもの・ペア系・タイ系は対象外 → 通常フローで入力)
 */
export function quickOutcomes(sideBets: SideBetDef[]): QuickOutcome[] {
  const out: QuickOutcome[] = []
  for (const d of sideBets) {
    if (!d.enabled || d.pairTarget || d.side === 'T') continue
    if (d.rules.some((r) => (r.loserTotals?.length ?? 0) > 0 || (r.totalCards?.length ?? 0) > 0)) continue
    const totals = new Set(d.rules.flatMap((r) => r.totals))
    if (totals.size !== 1) continue
    const total = [...totals][0]
    const cardsSet = new Set(d.rules.map((r) => r.cards))
    const cards = cardsSet.size === 1 ? [...cardsSet][0] : 'any'
    out.push({
      id: d.id,
      short: SHORT_NAMES[d.id] ?? d.name.slice(0, 3),
      name: d.name,
      side: d.side,
      input: {
        winner: d.side,
        winnerTotal: total,
        winnerCards: cards === '2' ? 2 : cards === '3' ? 3 : null,
        loserTotal: null,
        loserCards: null,
        pPair: null,
        bPair: null,
      },
    })
  }
  return out
}
