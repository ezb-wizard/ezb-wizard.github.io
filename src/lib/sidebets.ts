import type { SideBetDef } from '../types'
import { getOutcomeTable, type OutcomeBucket } from './baccarat'
import { matchRule } from './settle'

/**
 * プリセットサイドベット。配当はカジノごとに異なるためテーブル設定で変更可能。
 * デフォルト有効:D7・バンカー6・プレイヤー7(仕様どおりパンダ8はOFF)
 */
export function presetSideBets(): SideBetDef[] {
  return [
    {
      id: 'D7',
      name: 'ドラゴン7',
      side: 'B',
      rules: [{ totals: [7], cards: '3', payout: 40 }],
      enabled: true,
      preset: true,
    },
    {
      id: 'B6',
      name: 'バンカー6',
      side: 'B',
      rules: [{ totals: [6], cards: 'any', payout: 12 }],
      enabled: true,
      preset: true,
    },
    {
      id: 'P7',
      name: 'プレイヤー7',
      side: 'P',
      rules: [
        { totals: [7], cards: '2', payout: 6 },
        { totals: [7], cards: '3', payout: 15 },
      ],
      enabled: true,
      preset: true,
    },
    {
      id: 'PANDA8',
      name: 'パンダ8',
      side: 'P',
      rules: [{ totals: [8], cards: '3', payout: 25 }],
      enabled: false,
      preset: true,
    },
    {
      id: 'SMALL_TIGER',
      name: 'スモールタイガー',
      side: 'B',
      rules: [{ totals: [6], cards: '2', payout: 22 }],
      enabled: false,
      preset: true,
    },
    {
      id: 'BIG_TIGER',
      name: 'ビッグタイガー',
      side: 'B',
      rules: [{ totals: [6], cards: '3', payout: 50 }],
      enabled: false,
      preset: true,
    },
  ]
}

export interface SideBetStats {
  /** 成立確率(全ルール合算) */
  winProb: number
  /** 1単位あたり期待値(負 = 損失) */
  ev: number
  /** 控除率(= -EV) */
  edge: number
}

/**
 * 内蔵確率テーブル × 設定配当からサイドベットの控除率を動的算出。
 * 同名サイドベットでもカジノごとに配当が異なるため、固定値ではなく都度計算する。
 */
export function sideBetStats(def: SideBetDef, table: OutcomeBucket[] = getOutcomeTable()): SideBetStats {
  let winProb = 0
  let ev = 0
  for (const b of table) {
    const rule = matchRule(def, {
      winner: b.winner,
      winnerTotal: b.wTotal,
      winnerCards: b.wCards,
    })
    if (rule) {
      winProb += b.prob
      ev += b.prob * rule.payout
    }
  }
  ev -= 1 - winProb
  return { winProb, ev, edge: -ev }
}
