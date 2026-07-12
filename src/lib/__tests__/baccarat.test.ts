import { describe, expect, it } from 'vitest'
import { getOutcomeTable, getTheoreticalStats } from '../baccarat'
import { presetSideBets, sideBetStats } from '../sidebets'

/** 仕様書記載の理論値(8デッキ)との一致を検証 */
describe('8デッキ完全列挙の確率テーブル', () => {
  const t = getTheoreticalStats()

  it('全確率の合計は1', () => {
    const sum = getOutcomeTable().reduce((s, b) => s + b.prob, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('出現率:バンカー45.86% / プレイヤー44.62% / タイ9.52%', () => {
    expect(t.pBanker * 100).toBeCloseTo(45.86, 1)
    expect(t.pPlayer * 100).toBeCloseTo(44.62, 1)
    expect(t.pTie * 100).toBeCloseTo(9.52, 1)
  })

  it('ドラゴン7出現率 2.25%', () => {
    expect(t.pDragon7 * 100).toBeCloseTo(2.25, 1)
  })

  it('控除率:バンカー1.02% / プレイヤー1.24% / タイ14.36%(8:1)/ D7 7.61%(40:1)', () => {
    expect(t.edgeBankerEZ * 100).toBeCloseTo(1.02, 1)
    expect(t.edgePlayer * 100).toBeCloseTo(1.24, 1)
    expect(t.edgeTie8 * 100).toBeCloseTo(14.36, 1)
    expect(t.edgeDragon7 * 100).toBeCloseTo(7.61, 1)
  })
})

describe('サイドベット控除率の動的算出', () => {
  const defs = presetSideBets()

  it('D7(40:1)の控除率は約7.61%', () => {
    const d7 = defs.find((d) => d.id === 'D7')!
    expect(sideBetStats(d7).edge * 100).toBeCloseTo(7.61, 1)
  })

  it('パンダ8(25:1)の控除率は約10.2%', () => {
    const p8 = defs.find((d) => d.id === 'PANDA8')!
    const s = sideBetStats(p8)
    expect(s.winProb * 100).toBeCloseTo(3.45, 1)
    expect(s.edge * 100).toBeGreaterThan(9)
    expect(s.edge * 100).toBeLessThan(11)
  })

  it('バンカー6の配当を12:1→15:1に変えると控除率が下がる', () => {
    const b6 = defs.find((d) => d.id === 'B6')!
    const e12 = sideBetStats(b6).edge
    const e15 = sideBetStats({ ...b6, rules: [{ ...b6.rules[0], payout: 15 }] }).edge
    expect(e15).toBeLessThan(e12)
    expect(e12).toBeGreaterThan(0)
  })

  it('P7は2枚(6:1)と3枚(15:1)のルールを別々に評価する', () => {
    const p7 = defs.find((d) => d.id === 'P7')!
    const s = sideBetStats(p7)
    expect(s.winProb).toBeGreaterThan(0)
    expect(s.edge).toBeGreaterThan(0)
    expect(s.edge).toBeLessThan(0.3)
  })
})
