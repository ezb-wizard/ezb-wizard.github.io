import type { MainBetRules, SideBetDef } from '../types'
import { getTheoreticalStats, mainBetEdges } from './baccarat'
import { sideBetStats } from './sidebets'

/**
 * ベット先の数学的推奨(勝者の「予測」ではない)。
 * 控除率の低い順 = 長期的に最も損しにくい順。確率・控除率は出目に関係なく一定。
 */
export interface BetRecommendation {
  target: string
  name: string
  /** 控除率(期待損失率)。低いほど有利 */
  edge: number
  /** 成立(勝ち)確率 */
  winProb: number
  kind: 'main' | 'side'
}

/** 有効な全ベット先を控除率の低い順に並べる */
export function rankBets(rules: MainBetRules, sideBets: SideBetDef[]): BetRecommendation[] {
  const t = getTheoreticalStats()
  const edges = mainBetEdges(rules)
  const list: BetRecommendation[] = [
    { target: 'B', name: 'バンカー', edge: edges.banker, winProb: t.pBanker, kind: 'main' },
    { target: 'P', name: 'プレイヤー', edge: edges.player, winProb: t.pPlayer, kind: 'main' },
  ]
  if (rules.tieEnabled !== false) {
    list.push({
      target: 'T',
      name: `タイ(${rules.tiePayout}:1)`,
      edge: edges.tie,
      winProb: t.pTie,
      kind: 'main',
    })
  }
  for (const d of sideBets.filter((x) => x.enabled)) {
    const s = sideBetStats(d)
    list.push({ target: d.id, name: d.name, edge: s.edge, winProb: s.winProb, kind: 'side' })
  }
  return list.sort((a, b) => a.edge - b.edge)
}
