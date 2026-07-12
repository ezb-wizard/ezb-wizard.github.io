import type { BetPlacement, HandInput, SideBetDef, SideBetRule, Winner } from '../types'

export interface SettleContext {
  tiePayout: 8 | 9
  sideBets: SideBetDef[]
}

/** ドラゴン7(バンカー3枚合計7勝ち)判定。バンカー本線ベットのプッシュに必須 */
export function isDragon7(hand: HandInput): boolean {
  return hand.winner === 'B' && hand.winnerTotal === 7 && hand.winnerCards === 3
}

/** サイドベット定義に対して成立ルールを返す(不成立は null) */
export function matchRule(def: SideBetDef, hand: HandInput): SideBetRule | null {
  if (hand.winner !== def.side) return null
  for (const r of def.rules) {
    if (r.totals.length > 0) {
      if (hand.winnerTotal == null || !r.totals.includes(hand.winnerTotal)) continue
    }
    // タイ対象は枚数条件を扱わない(両ハンドの枚数が異なりうるため 'any' のみ)
    if (r.cards !== 'any' && def.side !== 'T') {
      if (hand.winnerCards == null || String(hand.winnerCards) !== r.cards) continue
    }
    return r
  }
  return null
}

/**
 * ベット1件の純損益(KRW)。EZバカラ・ノーコミッションルール:
 * - バンカー勝ち 1:1、ただしドラゴン7はプッシュ(0)
 * - プレイヤー勝ち 1:1
 * - タイ 8:1(設定で9:1)。タイ発生時の B/P ベットはプッシュ
 * - サイドベット:成立ルールの配当、不成立は没収
 */
export function settleBet(bet: BetPlacement, hand: HandInput, ctx: SettleContext): number {
  switch (bet.target) {
    case 'B':
      if (hand.winner === 'B') return isDragon7(hand) ? 0 : bet.amount
      return hand.winner === 'T' ? 0 : -bet.amount
    case 'P':
      if (hand.winner === 'P') return bet.amount
      return hand.winner === 'T' ? 0 : -bet.amount
    case 'T':
      return hand.winner === 'T' ? bet.amount * ctx.tiePayout : -bet.amount
    default: {
      const def = ctx.sideBets.find((d) => d.id === bet.target)
      if (!def) throw new Error(`未知のベット対象: ${bet.target}`)
      const rule = matchRule(def, hand)
      return rule ? bet.amount * rule.payout : -bet.amount
    }
  }
}

/** 複数同時ベットの合計純損益 */
export function settleHand(bets: BetPlacement[], hand: HandInput, ctx: SettleContext): number {
  return bets.reduce((sum, b) => sum + settleBet(b, hand, ctx), 0)
}

export type InputNeed = 'required' | 'optional' | 'none'

/**
 * 勝利合計値の入力要否。
 * バンカー勝ちは常に必須(D7プッシュ判定は本線精算に不可欠)。
 * P/Tは、合計値条件を持つ有効サイドベットがある場合のみ表示し、ベット中なら必須。
 */
export function totalNeed(winner: Winner, sideBets: SideBetDef[], bets: BetPlacement[]): InputNeed {
  if (winner === 'B') return 'required'
  const defs = sideBets.filter(
    (d) => d.enabled && d.side === winner && d.rules.some((r) => r.totals.length > 0),
  )
  if (defs.length === 0) return 'none'
  const betOn = defs.some((d) => bets.some((b) => b.target === d.id && b.amount > 0))
  return betOn ? 'required' : 'optional'
}

/**
 * 勝利ハンド枚数の入力要否。
 * バンカー合計7は常に必須(ドラゴン7判定)。
 * その他は、該当合計値で枚数条件を持つ有効サイドベットがある場合のみ表示し、ベット中なら必須。
 */
export function cardsNeed(
  winner: Winner,
  total: number | null,
  sideBets: SideBetDef[],
  bets: BetPlacement[],
): InputNeed {
  if (winner === 'B' && total === 7) return 'required'
  if (winner === 'T' || total == null) return 'none'
  const defs = sideBets.filter(
    (d) =>
      d.enabled &&
      d.side === winner &&
      d.rules.some((r) => r.cards !== 'any' && (r.totals.length === 0 || r.totals.includes(total))),
  )
  if (defs.length === 0) return 'none'
  const betOn = defs.some((d) => bets.some((b) => b.target === d.id && b.amount > 0))
  return betOn ? 'required' : 'optional'
}
