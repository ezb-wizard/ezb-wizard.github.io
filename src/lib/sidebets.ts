import type { HandInput, SideBetDef } from '../types'
import { getOutcomeTable, type OutcomeBucket } from './baccarat'
import { matchRule } from './settle'

/**
 * EZバカラ標準のサイドベットプリセット(旧バージョンのデフォルト構成)。
 * カジノ別プリセットは lib/casinos.ts を参照。
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
  ]
}

/** 確率テーブルのバケットを精算判定用の HandInput に変換 */
export function bucketToHand(b: OutcomeBucket): HandInput {
  const winnerIsB = b.winner === 'B'
  return {
    winner: b.winner,
    winnerTotal: winnerIsB ? b.bTotal : b.pTotal,
    winnerCards: winnerIsB ? b.bCards : b.pCards,
    loserTotal: winnerIsB ? b.pTotal : b.bTotal,
    loserCards: winnerIsB ? b.pCards : b.bCards,
    pPair: b.pPair,
    bPair: b.bPair,
  }
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
    const rule = matchRule(def, bucketToHand(b))
    if (rule) {
      winProb += b.prob
      ev += b.prob * rule.payout
    }
  }
  ev -= 1 - winProb
  return { winProb, ev, edge: -ev }
}
