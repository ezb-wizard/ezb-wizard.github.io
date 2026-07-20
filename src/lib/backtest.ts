import type { Hand, MainBetRules } from '../types'
import { mainBetEdges } from './baccarat'

/**
 * 出目パターン検証(バックテスト)。
 * 自分の全記録データに対して単純な賭け方を1単位フラットで適用し、
 * 「どの賭け方でも収支は控除率(理論期待損失)に収束する」ことを実データで確認する教育機能。
 * 予測機能ではない(過去データで成績が良くても次のハンドとは無関係)。
 */
export type BacktestStrategyId = 'banker' | 'player' | 'follow' | 'counter'

export const BACKTEST_NAMES: Record<BacktestStrategyId, string> = {
  banker: 'バンカー固定',
  player: 'プレイヤー固定',
  follow: 'ツラ追い(直前の勝者)',
  counter: 'テレコ(直前の逆)',
}

export interface BacktestResult {
  /** ベットしたハンド数(タイはプッシュとしてカウント) */
  betCount: number
  /** 実績損益(1単位フラットベット) */
  netUnits: number
  /** 理論期待損益 = -Σ(賭け先の控除率) */
  expectedUnits: number
  /** 累積損益の推移(x=ハンド番号, y=単位) */
  points: { x: number; y: number }[]
}

export function backtest(hands: Hand[], rules: MainBetRules, strategy: BacktestStrategyId): BacktestResult {
  const edges = mainBetEdges(rules)
  let last: 'B' | 'P' | null = null
  let betCount = 0
  let net = 0
  let expected = 0
  const points: { x: number; y: number }[] = []
  const step = Math.max(1, Math.ceil(hands.length / 300))

  hands.forEach((h, i) => {
    let side: 'B' | 'P' | null
    if (strategy === 'banker') side = 'B'
    else if (strategy === 'player') side = 'P'
    else if (strategy === 'follow') side = last
    else side = last === 'B' ? 'P' : last === 'P' ? 'B' : null

    if (side) {
      betCount++
      expected -= side === 'B' ? edges.banker : edges.player
      if (h.winner === 'T') {
        // プッシュ
      } else if (h.winner === side) {
        if (side === 'B') {
          // 特殊配当(EZ:D7プッシュ / スーパー6:6は半額)。合計値未記録のハンドは満額扱い(近似)
          if (rules.bankerRule === 'ez' && h.winnerTotal === 7 && h.winnerCards === 3) net += 0
          else if (rules.bankerRule === 'super6' && h.winnerTotal === 6) net += 0.5
          else net += rules.bankerPayout
        } else {
          net += rules.playerPayout
        }
      } else {
        net -= 1
      }
    }
    if (h.winner !== 'T') last = h.winner
    if ((i + 1) % step === 0 || i === hands.length - 1) points.push({ x: i + 1, y: net })
  })

  return { betCount, netUnits: net, expectedUnits: expected, points }
}
