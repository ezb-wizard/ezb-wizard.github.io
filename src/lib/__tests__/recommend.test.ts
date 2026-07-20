import { describe, expect, it } from 'vitest'
import { rankBets } from '../recommend'
import { casinoPreset } from '../casinos'
import { EZ_MAIN_BETS } from '../../types'

describe('ベット先推奨(控除率ランキング・予測ではない)', () => {
  it('PARADISE(B6半額)ではプレイヤーが最有利、次点バンカー', () => {
    const p = casinoPreset('PARADISE')
    const ranked = rankBets(p.mainBets, p.sideBets)
    expect(ranked[0].target).toBe('P')
    expect(ranked[1].target).toBe('B')
    // 全ベットが期待値マイナス(控除率>0)であること
    for (const r of ranked) expect(r.edge).toBeGreaterThan(0)
    // タイガー系がワースト帯に沈む
    expect(ranked[ranked.length - 1].target).toMatch(/TIGER/)
  })
  it('EZルールではバンカーが最有利', () => {
    const ranked = rankBets({ ...EZ_MAIN_BETS, tiePayout: 8 }, [])
    expect(ranked[0].target).toBe('B')
    expect(ranked[1].target).toBe('P')
  })
  it('本線タイなしの台ではタイ本線がランキングに出ない', () => {
    const p = casinoPreset('PARADISE')
    const ranked = rankBets(p.mainBets, p.sideBets)
    expect(ranked.some((r) => r.target === 'T')).toBe(false)
    expect(ranked.some((r) => r.target === 'TIE_MAX_06')).toBe(true)
  })
})
