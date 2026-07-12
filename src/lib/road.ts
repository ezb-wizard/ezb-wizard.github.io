import type { Hand, SideBetDef } from '../types'
import { matchRule } from './settle'

export interface RoadCell {
  col: number
  row: number
  winner: 'B' | 'P'
  /** このセルに付くタイ回数 */
  ties: number
  d7: boolean
  /** 成立した有効サイドベット名 */
  marks: string[]
}

/**
 * 大路(ビッグロード)配置。同一勝者は下に伸び、6行超過・衝突時は右へ折れる(龍尾)。
 * タイは直前セルにカウント付与(先頭のタイは次の最初のセルに付与)。
 */
export function buildBigRoad(
  hands: Hand[],
  sideBets: SideBetDef[],
): { cells: RoadCell[]; cols: number; leadingTies: number } {
  const occupied = new Set<string>()
  const cells: RoadCell[] = []
  let cur: RoadCell | null = null
  let streakWinner: 'B' | 'P' | null = null
  let streakStartCol = -1
  let pendingTies = 0
  const enabled = sideBets.filter((d) => d.enabled)

  for (const h of hands) {
    if (h.winner === 'T') {
      if (cur) cur.ties++
      else pendingTies++
      continue
    }
    const w = h.winner
    let col: number
    let row: number
    if (w === streakWinner && cur) {
      if (cur.row < 5 && !occupied.has(`${cur.col},${cur.row + 1}`)) {
        col = cur.col
        row = cur.row + 1
      } else {
        col = cur.col + 1
        row = cur.row
        while (occupied.has(`${col},${row}`)) col++
      }
    } else {
      col = streakStartCol + 1
      row = 0
      while (occupied.has(`${col},${row}`)) col++
      streakStartCol = col
      streakWinner = w
    }
    const cell: RoadCell = {
      col,
      row,
      winner: w,
      ties: pendingTies,
      d7: w === 'B' && h.winnerTotal === 7 && h.winnerCards === 3,
      marks: enabled.filter((d) => matchRule(d, h) != null).map((d) => d.name),
    }
    pendingTies = 0
    occupied.add(`${col},${row}`)
    cells.push(cell)
    cur = cell
  }
  const cols = cells.reduce((m, c) => Math.max(m, c.col + 1), 0)
  return { cells, cols, leadingTies: cells.length === 0 ? pendingTies : 0 }
}
