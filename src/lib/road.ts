import type { Hand, SideBetDef, Winner } from '../types'
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

/** 珠盤路(ビーズプレート):タイ含む全結果を上から下・左から右へ順に並べる */
export function buildBeadPlate(hands: Hand[]): { col: number; row: number; winner: Winner }[] {
  return hands.map((h, i) => ({ col: Math.floor(i / 6), row: i % 6, winner: h.winner }))
}

/** 大路の論理列(タイを除く連の長さ。龍尾の折れを無視した派生罫線の計算基盤) */
export function logicalStreaks(hands: Hand[]): number[] {
  const streaks: number[] = []
  let last: 'B' | 'P' | null = null
  for (const h of hands) {
    if (h.winner === 'T') continue
    if (h.winner === last) streaks[streaks.length - 1]++
    else {
      streaks.push(1)
      last = h.winner
    }
  }
  return streaks
}

export type DerivedMark = 'R' | 'B'

/**
 * 派生罫線(大眼仔路 L=1 / 小路 L=2 / 甲由路 L=3)。
 * 大路のセル(c,r)ごとに、Lつ左の列と規則性を比較して赤(規則的)/青(不規則)を打つ。
 * - r=0(新しい列): 直前列と、そのLつ左の列の長さが同じなら赤
 * - r>0(連の継続): Lつ左の列に同じ行のセルがあれば赤、1つ浅く終わっていれば青、
 *   それより浅い(飛び越し)なら赤
 */
export function deriveRoad(streaks: number[], lookback: number): DerivedMark[] {
  const marks: DerivedMark[] = []
  for (let c = 0; c < streaks.length; c++) {
    for (let r = 0; r < streaks[c]; r++) {
      if (c < lookback || (c === lookback && r === 0)) continue
      if (r === 0) {
        marks.push(streaks[c - 1] === streaks[c - 1 - lookback] ? 'R' : 'B')
      } else {
        const n = streaks[c - lookback]
        marks.push(n >= r + 1 ? 'R' : n === r ? 'B' : 'R')
      }
    }
  }
  return marks
}

/** 派生罫線マークを6行グリッドに配置(大路と同じ:同色は下へ、6行超・衝突は右へ) */
export function layoutDerived(marks: DerivedMark[]): { col: number; row: number; mark: DerivedMark }[] {
  const occupied = new Set<string>()
  const cells: { col: number; row: number; mark: DerivedMark }[] = []
  let cur: { col: number; row: number } | null = null
  let last: DerivedMark | null = null
  let streakStartCol = -1
  for (const m of marks) {
    let col: number
    let row: number
    if (m === last && cur) {
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
      last = m
    }
    occupied.add(`${col},${row}`)
    cur = { col, row }
    cells.push({ col, row, mark: m })
  }
  return cells
}
