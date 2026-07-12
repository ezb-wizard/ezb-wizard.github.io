import { describe, expect, it } from 'vitest'
import { cardsNeed, isDragon7, settleBet, settleHand, totalNeed, type SettleContext } from '../settle'
import { presetSideBets } from '../sidebets'
import type { HandInput } from '../../types'

const ctx: SettleContext = { tiePayout: 8, sideBets: presetSideBets() }
const ctx9: SettleContext = { tiePayout: 9, sideBets: presetSideBets() }

const bWin = (total: number, cards: 2 | 3 | null = null): HandInput => ({
  winner: 'B',
  winnerTotal: total,
  winnerCards: cards,
})
const pWin = (total: number, cards: 2 | 3 | null = null): HandInput => ({
  winner: 'P',
  winnerTotal: total,
  winnerCards: cards,
})
const tie = (total: number | null = null): HandInput => ({
  winner: 'T',
  winnerTotal: total,
  winnerCards: null,
})

describe('本線精算(EZバカラ・ノーコミッション)', () => {
  it('バンカー勝ち 1:1', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(5, 2), ctx)).toBe(10000)
  })
  it('ドラゴン7(バンカー3枚合計7)ではバンカーベットはプッシュ', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(7, 3), ctx)).toBe(0)
    expect(isDragon7(bWin(7, 3))).toBe(true)
  })
  it('バンカー2枚合計7勝ちは通常勝ち(D7ではない)', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(7, 2), ctx)).toBe(10000)
    expect(isDragon7(bWin(7, 2))).toBe(false)
  })
  it('プレイヤー勝ち 1:1 / バンカーベットは没収', () => {
    expect(settleBet({ target: 'P', amount: 10000 }, pWin(8), ctx)).toBe(10000)
    expect(settleBet({ target: 'B', amount: 10000 }, pWin(8), ctx)).toBe(-10000)
  })
  it('タイ発生時のB/Pベットはプッシュ、タイベットは8:1(設定で9:1)', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, tie(6), ctx)).toBe(0)
    expect(settleBet({ target: 'P', amount: 10000 }, tie(6), ctx)).toBe(0)
    expect(settleBet({ target: 'T', amount: 10000 }, tie(6), ctx)).toBe(80000)
    expect(settleBet({ target: 'T', amount: 10000 }, tie(6), ctx9)).toBe(90000)
    expect(settleBet({ target: 'T', amount: 10000 }, bWin(5, 2), ctx)).toBe(-10000)
  })
})

describe('サイドベット精算', () => {
  it('ドラゴン7 40:1', () => {
    expect(settleBet({ target: 'D7', amount: 10000 }, bWin(7, 3), ctx)).toBe(400000)
    expect(settleBet({ target: 'D7', amount: 10000 }, bWin(7, 2), ctx)).toBe(-10000)
    expect(settleBet({ target: 'D7', amount: 10000 }, pWin(7, 3), ctx)).toBe(-10000)
  })
  it('バンカー6(枚数任意)12:1', () => {
    expect(settleBet({ target: 'B6', amount: 10000 }, bWin(6, 2), ctx)).toBe(120000)
    expect(settleBet({ target: 'B6', amount: 10000 }, bWin(6, 3), ctx)).toBe(120000)
    expect(settleBet({ target: 'B6', amount: 10000 }, bWin(5, 2), ctx)).toBe(-10000)
  })
  it('プレイヤー7:2枚6:1 / 3枚15:1', () => {
    expect(settleBet({ target: 'P7', amount: 10000 }, pWin(7, 2), ctx)).toBe(60000)
    expect(settleBet({ target: 'P7', amount: 10000 }, pWin(7, 3), ctx)).toBe(150000)
    expect(settleBet({ target: 'P7', amount: 10000 }, bWin(7, 2), ctx)).toBe(-10000)
  })
  it('パンダ8(プレイヤー3枚合計8)25:1', () => {
    expect(settleBet({ target: 'PANDA8', amount: 10000 }, pWin(8, 3), ctx)).toBe(250000)
    expect(settleBet({ target: 'PANDA8', amount: 10000 }, pWin(8, 2), ctx)).toBe(-10000)
  })
  it('タイガー系:スモール(2枚)22:1・ビッグ(3枚)50:1', () => {
    expect(settleBet({ target: 'SMALL_TIGER', amount: 10000 }, bWin(6, 2), ctx)).toBe(220000)
    expect(settleBet({ target: 'SMALL_TIGER', amount: 10000 }, bWin(6, 3), ctx)).toBe(-10000)
    expect(settleBet({ target: 'BIG_TIGER', amount: 10000 }, bWin(6, 3), ctx)).toBe(500000)
    expect(settleBet({ target: 'BIG_TIGER', amount: 10000 }, bWin(6, 2), ctx)).toBe(-10000)
  })
})

describe('複数同時ベットの精算', () => {
  it('D7発生時:バンカー本線プッシュ + D7的中 + タイ没収', () => {
    const net = settleHand(
      [
        { target: 'B', amount: 100000 },
        { target: 'D7', amount: 10000 },
        { target: 'T', amount: 5000 },
      ],
      bWin(7, 3),
      ctx,
    )
    expect(net).toBe(0 + 400000 - 5000)
  })
  it('タイ発生時:B/Pプッシュ + タイ的中 + サイド没収', () => {
    const net = settleHand(
      [
        { target: 'B', amount: 100000 },
        { target: 'P', amount: 50000 },
        { target: 'T', amount: 10000 },
        { target: 'D7', amount: 5000 },
      ],
      tie(4),
      ctx,
    )
    expect(net).toBe(0 + 0 + 80000 - 5000)
  })
})

describe('補助入力の要否判定', () => {
  const sides = presetSideBets() // D7/B6/P7 有効
  it('バンカー勝ちは常に合計値必須、合計7は枚数必須', () => {
    expect(totalNeed('B', sides, [])).toBe('required')
    expect(cardsNeed('B', 7, sides, [])).toBe('required')
    expect(cardsNeed('B', 5, sides, [])).toBe('none')
  })
  it('プレイヤー勝ちはP7有効時のみ合計値を表示、ベット中は必須', () => {
    expect(totalNeed('P', sides, [])).toBe('optional')
    expect(totalNeed('P', sides, [{ target: 'P7', amount: 10000 }])).toBe('required')
    const noSides = sides.map((d) => ({ ...d, enabled: false }))
    expect(totalNeed('P', noSides, [])).toBe('none')
  })
  it('P7ベット中はプレイヤー合計7の枚数が必須(2枚/3枚で配当が異なる)', () => {
    expect(cardsNeed('P', 7, sides, [{ target: 'P7', amount: 10000 }])).toBe('required')
    expect(cardsNeed('P', 7, sides, [])).toBe('optional')
  })
  it('タイガー有効+ベット中はバンカー合計6の枚数が必須', () => {
    const withTiger = sides.map((d) => (d.id === 'SMALL_TIGER' ? { ...d, enabled: true } : d))
    expect(cardsNeed('B', 6, withTiger, [{ target: 'SMALL_TIGER', amount: 10000 }])).toBe('required')
    expect(cardsNeed('B', 6, withTiger, [])).toBe('optional')
    expect(cardsNeed('B', 6, sides, [])).toBe('none')
  })
})
