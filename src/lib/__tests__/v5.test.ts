import { describe, expect, it } from 'vitest'
import { quickOutcomes } from '../quickOutcomes'
import { backtest } from '../backtest'
import { casinoPreset } from '../casinos'
import { presetSideBets } from '../sidebets'
import { EZ_MAIN_BETS, type Hand, type MainBetRules, type Winner } from '../../types'

const hand = (winner: Winner, total: number | null = null, cards: 2 | 3 | null = null): Hand => ({
  winner,
  winnerTotal: total,
  winnerCards: cards,
  sessionId: 1,
  seq: 0,
  ts: 0,
  bets: [],
  net: 0,
})

describe('ワンタップ結果ボタンの導出', () => {
  it('PARADISEはSD/BD/ST/BTの4つ(DT・TIE MAX・ペアは対象外)', () => {
    const q = quickOutcomes(casinoPreset('PARADISE').sideBets)
    expect(q.map((x) => x.id).sort()).toEqual(['BIG_DRAGON', 'BIG_TIGER', 'SMALL_DRAGON', 'SMALL_TIGER'])
    const st = q.find((x) => x.id === 'SMALL_TIGER')!
    expect(st.input).toMatchObject({ winner: 'B', winnerTotal: 6, winnerCards: 2 })
  })
  it('EZ標準プリセットはD7/B6/P7(B6・P7は枚数不定→null)', () => {
    const q = quickOutcomes(presetSideBets())
    const ids = q.map((x) => x.id)
    expect(ids).toContain('D7')
    expect(ids).toContain('B6')
    expect(ids).toContain('P7')
    expect(q.find((x) => x.id === 'D7')!.input).toMatchObject({ winner: 'B', winnerTotal: 7, winnerCards: 3 })
    expect(q.find((x) => x.id === 'B6')!.input.winnerCards).toBeNull()
    expect(q.find((x) => x.id === 'P7')!.input.winnerCards).toBeNull()
  })
})

describe('出目パターン検証(バックテスト)', () => {
  const EZ: MainBetRules = { ...EZ_MAIN_BETS, tiePayout: 8 }
  const hands = [hand('B'), hand('B'), hand('P'), hand('B')]

  it('バンカー固定: 全ハンドにベットし勝敗どおり', () => {
    const r = backtest(hands, EZ, 'banker')
    expect(r.betCount).toBe(4)
    expect(r.netUnits).toBe(2) // +1 +1 -1 +1
    expect(r.expectedUnits).toBeCloseTo(-4 * 0.010185, 3)
  })
  it('ツラ追い: 最初のハンドは見送り、直前の勝者に賭ける', () => {
    const r = backtest(hands, EZ, 'follow')
    expect(r.betCount).toBe(3)
    expect(r.netUnits).toBe(-1) // B勝ち+1, P負け-1, B負け-1
  })
  it('テレコ: 直前の逆に賭ける', () => {
    const r = backtest(hands, EZ, 'counter')
    expect(r.betCount).toBe(3)
    expect(r.netUnits).toBe(1) // P負け-1, P勝ち+1... 逆: -1 +1 +1
  })
  it('タイはプッシュ(ベット数に数えるが収支±0)', () => {
    const r = backtest([hand('B'), hand('T'), hand('B')], EZ, 'follow')
    expect(r.betCount).toBe(2)
    expect(r.netUnits).toBe(1) // T=push, B勝ち+1
  })
  it('スーパー6式: バンカー6勝ちは+0.5、EZ式: D7はプッシュ', () => {
    const S6: MainBetRules = { playerPayout: 1, bankerPayout: 1, bankerRule: 'super6', tiePayout: 8 }
    expect(backtest([hand('B', 6, 2)], S6, 'banker').netUnits).toBe(0.5)
    expect(backtest([hand('B', 7, 3)], EZ, 'banker').netUnits).toBe(0)
  })
})
