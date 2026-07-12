import { describe, expect, it } from 'vitest'
import { buildBigRoad, deriveRoad, layoutDerived, logicalStreaks } from '../road'
import type { Hand, Winner } from '../../types'

const hand = (winner: Winner, seq: number): Hand => ({
  winner,
  winnerTotal: null,
  winnerCards: null,
  sessionId: 1,
  seq,
  ts: seq,
  bets: [],
  net: 0,
})

const hands = (s: string): Hand[] => [...s].map((c, i) => hand(c as Winner, i + 1))

describe('大路', () => {
  it('同一勝者は下に伸び、勝者が変わると新しい列になる', () => {
    const { cells, cols } = buildBigRoad(hands('BBPBB'), [])
    expect(cols).toBe(3)
    expect(cells.map((c) => [c.col, c.row])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [2, 0],
      [2, 1],
    ])
  })
  it('7連勝は6行で折れて右に伸びる(龍尾)', () => {
    const { cells } = buildBigRoad(hands('BBBBBBB'), [])
    expect(cells[5]).toMatchObject({ col: 0, row: 5 })
    expect(cells[6]).toMatchObject({ col: 1, row: 5 })
  })
  it('タイは直前セルにカウントされる', () => {
    const { cells } = buildBigRoad(hands('BTTP'), [])
    expect(cells).toHaveLength(2)
    expect(cells[0].ties).toBe(2)
  })
})

describe('論理列(派生罫線の基盤)', () => {
  it('タイを除いた連の長さを返す', () => {
    expect(logicalStreaks(hands('BBTPPPTB'))).toEqual([2, 3, 1])
  })
})

describe('派生罫線(大眼仔路 L=1)', () => {
  it('開始位置は大路の(2列目,2行目)または(3列目,1行目)以降', () => {
    expect(deriveRoad([1], 1)).toEqual([])
    expect(deriveRoad([1, 1], 1)).toEqual([]) // (c=1,r=0)はまだ開始前
    expect(deriveRoad([2, 1], 1)).toEqual([]) // c=0のみ+c=1,r=0 → なし
    expect(deriveRoad([1, 2], 1)).toHaveLength(1) // (c=1,r=1)が最初のマーク
  })
  it('r=0: 直前2列の長さが等しければ赤(規則的)、異なれば青', () => {
    // 列[1,1] → 3列目の先頭: len(col1)=1 == len(col0)=1 → R(ピンポン)
    expect(deriveRoad([1, 1, 1], 1)).toEqual(['R'])
    // 列[2,1] → 3列目の先頭: len(col1)=1 != len(col0)=2 → B
    expect(deriveRoad([2, 1, 1], 1)).toEqual(['B'])
  })
  it('r>0: 左隣の列に同じ深さがあれば赤、1つ浅ければ青', () => {
    // 列[2,2]: (c=1,r=1) → n=len(col0)=2 >= 2 → R
    expect(deriveRoad([2, 2], 1)).toEqual(['R'])
    // 列[1,2]: (c=1,r=1) → n=1 == r=1 → B
    expect(deriveRoad([1, 2], 1)).toEqual(['B'])
    // 完全な規則パターン [2,2,2] はすべて赤
    expect(deriveRoad([2, 2, 2], 1)).toEqual(['R', 'R', 'R'])
  })
})

describe('派生罫線(小路 L=2・甲由路 L=3)', () => {
  it('開始位置がそれぞれ1列ずつ遅れる', () => {
    expect(deriveRoad([2, 2, 2], 2)).toHaveLength(1) // (c=2,r=1)のみ
    expect(deriveRoad([2, 2, 2], 3)).toHaveLength(0)
    expect(deriveRoad([2, 2, 2, 2], 3)).toHaveLength(1)
  })
  it('L=2はr=0で1列前と3列前を比較する', () => {
    // streaks [1,2,1,?]: (c=3,r=0) → len(col2)=1 vs len(col0)=1 → R
    expect(deriveRoad([1, 2, 1, 1], 2).at(-1)).toBe('R')
    // streaks [2,2,1,?]: (c=3,r=0) → len(col2)=1 vs len(col0)=2 → B
    expect(deriveRoad([2, 2, 1, 1], 2).at(-1)).toBe('B')
  })
})

describe('派生罫線の配置', () => {
  it('同色は下に、色が変わると新しい列に置かれる', () => {
    const cells = layoutDerived(['R', 'R', 'B', 'R'])
    expect(cells.map((c) => [c.col, c.row])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [2, 0],
    ])
  })
  it('6個超の同色は右に折れる', () => {
    const cells = layoutDerived(Array.from({ length: 8 }, () => 'R' as const))
    expect(cells[5]).toMatchObject({ col: 0, row: 5 })
    expect(cells[6]).toMatchObject({ col: 1, row: 5 })
  })
})
