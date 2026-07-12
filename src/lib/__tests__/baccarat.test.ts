import { describe, expect, it } from 'vitest'
import { getOutcomeTable, getTheoreticalStats, mainBetEdges } from '../baccarat'
import { presetSideBets, sideBetStats } from '../sidebets'
import { casinoPreset } from '../casinos'
import { EZ_MAIN_BETS } from '../../types'

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

  it('控除率:EZバンカー1.02% / プレイヤー1.24% / タイ14.36%(8:1)/ D7 7.61%(40:1)', () => {
    expect(t.edgeBankerEZ * 100).toBeCloseTo(1.02, 1)
    expect(t.edgePlayer * 100).toBeCloseTo(1.24, 1)
    expect(t.edgeTie8 * 100).toBeCloseTo(14.36, 1)
    expect(t.edgeDragon7 * 100).toBeCloseTo(7.61, 1)
  })

  it('ペア出現率 約7.47%(8デッキ・同ランク2枚)', () => {
    // 理論値: 13 × (32×31) / (416×415) = 7.468%
    expect(t.pPlayerPair * 100).toBeCloseTo(7.47, 1)
  })
})

describe('本線控除率の動的算出', () => {
  it('コミッション式バンカー(0.95:1)の控除率は約1.06%', () => {
    const e = mainBetEdges({ playerPayout: 1, bankerPayout: 0.95, bankerRule: 'commission', tiePayout: 8 })
    expect(e.banker * 100).toBeCloseTo(1.06, 1)
    expect(e.player * 100).toBeCloseTo(1.24, 1)
  })
  it('EZバンカーの控除率は約1.02%', () => {
    const e = mainBetEdges({ ...EZ_MAIN_BETS, tiePayout: 8 })
    expect(e.banker * 100).toBeCloseTo(1.02, 1)
  })
})

describe('サイドベット控除率の動的算出', () => {
  const legacy = presetSideBets()

  it('D7(40:1)の控除率は約7.61%', () => {
    const d7 = legacy.find((d) => d.id === 'D7')!
    expect(sideBetStats(d7).edge * 100).toBeCloseTo(7.61, 1)
  })

  it('ペアベット(11:1)の控除率は約10.36%', () => {
    const pp = casinoPreset('INSPIRE').sideBets.find((d) => d.id === 'P_PAIR')!
    const s = sideBetStats(pp)
    expect(s.winProb * 100).toBeCloseTo(7.47, 1)
    expect(s.edge * 100).toBeCloseTo(10.36, 1)
  })

  it('イーザーペア(5:1)の控除率は約13〜15%', () => {
    const ep = casinoPreset('INSPIRE').sideBets.find((d) => d.id === 'EITHER_PAIR')!
    const s = sideBetStats(ep)
    expect(s.winProb).toBeGreaterThan(0.13)
    expect(s.winProb).toBeLessThan(0.16)
    expect(s.edge).toBeGreaterThan(0.1)
    expect(s.edge).toBeLessThan(0.16)
  })

  it('Dragon Tigerの成立確率はカジノ間で一致(条件同一・配当のみ異なる)', () => {
    const dtP = casinoPreset('PARADISE').sideBets.find((d) => d.id === 'DRAGON_TIGER')!
    const dtI = casinoPreset('INSPIRE').sideBets.find((d) => d.id === 'DRAGON_TIGER')!
    const sP = sideBetStats(dtP)
    const sI = sideBetStats(dtI)
    expect(sP.winProb).toBeCloseTo(sI.winProb, 10)
    expect(sP.winProb).toBeGreaterThan(0)
    // PARADISEは高配当帯(40/100)を含むためINSPIRE(一律30)より控除率が低い
    expect(sP.edge).toBeLessThan(sI.edge)
    expect(sI.edge).toBeGreaterThan(0)
    expect(sI.edge).toBeLessThan(1)
  })

  it('Small/Big Dragon・Tigerの成立確率は排他的に分割される', () => {
    const sides = casinoPreset('PARADISE').sideBets
    const sd = sideBetStats(sides.find((d) => d.id === 'SMALL_DRAGON')!)
    const bd = sideBetStats(sides.find((d) => d.id === 'BIG_DRAGON')!)
    const t = getTheoreticalStats()
    // P合計7勝ちの全確率 = SD(2枚) + BD(3枚)
    const p7win = getOutcomeTable()
      .filter((b) => b.winner === 'P' && b.pTotal === 7)
      .reduce((s, b) => s + b.prob, 0)
    expect(sd.winProb + bd.winProb).toBeCloseTo(p7win, 10)
    expect(t.pPlayer).toBeGreaterThan(p7win)
  })

  it('バンカー6の配当を12:1→15:1に変えると控除率が下がる(動的算出)', () => {
    const b6 = legacy.find((d) => d.id === 'B6')!
    const e12 = sideBetStats(b6).edge
    const e15 = sideBetStats({ ...b6, rules: [{ ...b6.rules[0], payout: 15 }] }).edge
    expect(e15).toBeLessThan(e12)
  })
})
