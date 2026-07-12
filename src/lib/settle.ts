import type { BetPlacement, HandInput, MainBetRules, SideBetDef, SideBetRule, Winner } from '../types'

export interface SettleContext {
  mainBets: MainBetRules
  sideBets: SideBetDef[]
}

/** ドラゴン7(バンカー3枚合計7勝ち)判定。EZルールのバンカー本線プッシュに必須 */
export function isDragon7(hand: HandInput): boolean {
  return hand.winner === 'B' && hand.winnerTotal === 7 && hand.winnerCards === 3
}

/** サイドベット定義に対して成立ルールを返す(不成立は null) */
export function matchRule(def: SideBetDef, hand: HandInput): SideBetRule | null {
  // ペア系:勝者と無関係に最初の2枚のペアで判定
  if (def.pairTarget) {
    const hit =
      def.pairTarget === 'P'
        ? hand.pPair === true
        : def.pairTarget === 'B'
          ? hand.bPair === true
          : hand.pPair === true || hand.bPair === true
    return hit ? (def.rules[0] ?? null) : null
  }
  if (hand.winner !== def.side) return null
  for (const r of def.rules) {
    if (r.totals.length > 0) {
      if (hand.winnerTotal == null || !r.totals.includes(hand.winnerTotal)) continue
    }
    // タイ対象は枚数条件を扱わない(両ハンドの枚数が異なりうるため 'any' のみ)
    if (r.cards !== 'any' && def.side !== 'T') {
      if (hand.winnerCards == null || String(hand.winnerCards) !== r.cards) continue
    }
    if (r.loserTotals && r.loserTotals.length > 0) {
      if (hand.loserTotal == null || !r.loserTotals.includes(hand.loserTotal)) continue
    }
    if (r.totalCards && r.totalCards.length > 0) {
      if (hand.winnerCards == null || hand.loserCards == null) continue
      if (!r.totalCards.includes(hand.winnerCards + hand.loserCards)) continue
    }
    return r
  }
  return null
}

/**
 * ベット1件の純損益(KRW)。
 * - バンカー本線:'ez' = 1:1でドラゴン7プッシュ / 'commission' = bankerPayout倍(例0.95)
 * - プレイヤー本線:playerPayout倍。タイ発生時のB/Pベットはプッシュ
 * - タイ:tiePayout倍
 * - サイドベット:成立ルールの配当、不成立は没収
 */
export function settleBet(bet: BetPlacement, hand: HandInput, ctx: SettleContext): number {
  const rules = ctx.mainBets
  switch (bet.target) {
    case 'B':
      if (hand.winner === 'B') {
        if (rules.bankerRule === 'ez' && isDragon7(hand)) return 0
        return bet.amount * rules.bankerPayout
      }
      return hand.winner === 'T' ? 0 : -bet.amount
    case 'P':
      if (hand.winner === 'P') return bet.amount * rules.playerPayout
      return hand.winner === 'T' ? 0 : -bet.amount
    case 'T':
      return hand.winner === 'T' ? bet.amount * rules.tiePayout : -bet.amount
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

const betOn = (defs: SideBetDef[], bets: BetPlacement[]) =>
  defs.some((d) => bets.some((b) => b.target === d.id && b.amount > 0))

const need = (defs: SideBetDef[], bets: BetPlacement[]): InputNeed =>
  defs.length === 0 ? 'none' : betOn(defs, bets) ? 'required' : 'optional'

/**
 * 勝利合計値の入力要否。
 * EZルールのバンカー勝ちは常に必須(D7プッシュ判定は本線精算に不可欠)。
 * それ以外は、合計値条件を持つ有効サイドベットがある場合のみ表示し、ベット中なら必須。
 */
export function totalNeed(
  winner: Winner,
  sideBets: SideBetDef[],
  bets: BetPlacement[],
  rules: MainBetRules,
): InputNeed {
  if (winner === 'B' && rules.bankerRule === 'ez') return 'required'
  const defs = sideBets.filter(
    (d) => d.enabled && !d.pairTarget && d.side === winner && d.rules.some((r) => r.totals.length > 0),
  )
  return need(defs, bets)
}

/** ルールの totals 条件が「現時点の勝ち側合計の情報」でまだ成立しうるか */
const totalsMayMatch = (r: SideBetRule, total: number | null) =>
  r.totals.length === 0 || (total != null && r.totals.includes(total))

/**
 * 勝利ハンド枚数の入力要否。
 * EZルールのバンカー合計7は常に必須(ドラゴン7判定)。
 * その他は、枚数条件(または合計枚数条件)を持つ有効サイドベットが成立しうる場合のみ。
 * 合計値任意(totals空)の定義は勝ち側合計が未入力でも枚数を要求する。
 */
export function cardsNeed(
  winner: Winner,
  total: number | null,
  sideBets: SideBetDef[],
  bets: BetPlacement[],
  rules: MainBetRules,
): InputNeed {
  if (winner === 'B' && total === 7 && rules.bankerRule === 'ez') return 'required'
  if (winner === 'T') return 'none'
  const defs = sideBets.filter(
    (d) =>
      d.enabled &&
      !d.pairTarget &&
      d.side === winner &&
      d.rules.some(
        (r) =>
          (r.cards !== 'any' || (r.totalCards?.length ?? 0) > 0) && totalsMayMatch(r, total),
      ),
  )
  return need(defs, bets)
}

/**
 * 負け側の合計値・枚数の入力要否(Dragon Tiger等の loserTotals / totalCards 条件)。
 * 枚数は、入力済みの負け側合計で成立の可能性が残っているルールがある場合のみ要求する
 * (例: PARADISEのDTで負け側が6以外なら不成立確定のため枚数は不要)。
 */
export function loserNeed(
  winner: Winner,
  total: number | null,
  loserTotal: number | null,
  sideBets: SideBetDef[],
  bets: BetPlacement[],
): { total: InputNeed; cards: InputNeed } {
  if (winner === 'T') return { total: 'none', cards: 'none' }
  const defs = sideBets.filter(
    (d) =>
      d.enabled &&
      !d.pairTarget &&
      d.side === winner &&
      d.rules.some((r) => (r.loserTotals?.length ?? 0) > 0 && totalsMayMatch(r, total)),
  )
  const totalN = need(defs, bets)
  if (totalN === 'none') return { total: 'none', cards: 'none' }
  const cardDefs = defs.filter((d) =>
    d.rules.some(
      (r) =>
        (r.totalCards?.length ?? 0) > 0 &&
        totalsMayMatch(r, total) &&
        (loserTotal == null || !r.loserTotals?.length || r.loserTotals.includes(loserTotal)),
    ),
  )
  return { total: totalN, cards: need(cardDefs, bets) }
}

/**
 * 未入力(null)を「まだ分からない」として扱った場合に、成立の可能性が残っているか。
 * 統計(実績 vs 理論値)で「不成立」と「判定不能」を区別するために使う。精算には使わない。
 */
export function possibleMatch(def: SideBetDef, hand: HandInput): boolean {
  if (matchRule(def, hand)) return true
  if (def.pairTarget) {
    if (def.pairTarget === 'P') return hand.pPair == null
    if (def.pairTarget === 'B') return hand.bPair == null
    return hand.pPair == null || hand.bPair == null
  }
  if (hand.winner !== def.side) return false
  return def.rules.some((r) => {
    if (r.totals.length > 0 && hand.winnerTotal != null && !r.totals.includes(hand.winnerTotal)) return false
    if (r.cards !== 'any' && def.side !== 'T' && hand.winnerCards != null && String(hand.winnerCards) !== r.cards)
      return false
    if ((r.loserTotals?.length ?? 0) > 0 && hand.loserTotal != null && !r.loserTotals!.includes(hand.loserTotal))
      return false
    if ((r.totalCards?.length ?? 0) > 0 && hand.winnerCards != null && hand.loserCards != null) {
      if (!r.totalCards!.includes(hand.winnerCards + hand.loserCards)) return false
    }
    return true
  })
}

/** ペア有無の入力要否(ペア系ベットが有効な場合のみ表示・ベット中は必須) */
export function pairNeed(sideBets: SideBetDef[], bets: BetPlacement[]): InputNeed {
  const defs = sideBets.filter((d) => d.enabled && d.pairTarget)
  return need(defs, bets)
}
