import { describe, expect, it } from 'vitest'
import {
  cardsNeed,
  isDragon7,
  loserNeed,
  pairNeed,
  possibleMatch,
  settleBet,
  settleHand,
  totalNeed,
  type SettleContext,
} from '../settle'
import { presetSideBets } from '../sidebets'
import { casinoPreset } from '../casinos'
import { EZ_MAIN_BETS, sessionRules, type HandInput, type MainBetRules } from '../../types'

const EZ8: MainBetRules = { ...EZ_MAIN_BETS, tiePayout: 8 }
const EZ9: MainBetRules = { ...EZ_MAIN_BETS, tiePayout: 9 }
const COMMISSION: MainBetRules = { playerPayout: 1, bankerPayout: 0.95, bankerRule: 'commission', tiePayout: 8 }

const ctx: SettleContext = { mainBets: EZ8, sideBets: presetSideBets() }
const ctx9: SettleContext = { mainBets: EZ9, sideBets: presetSideBets() }
const ctxCom: SettleContext = { mainBets: COMMISSION, sideBets: [] }

const bWin = (total: number, cards: 2 | 3 | null = null, extra: Partial<HandInput> = {}): HandInput => ({
  winner: 'B',
  winnerTotal: total,
  winnerCards: cards,
  ...extra,
})
const pWin = (total: number, cards: 2 | 3 | null = null, extra: Partial<HandInput> = {}): HandInput => ({
  winner: 'P',
  winnerTotal: total,
  winnerCards: cards,
  ...extra,
})
const tie = (total: number | null = null): HandInput => ({
  winner: 'T',
  winnerTotal: total,
  winnerCards: null,
})

describe('本線精算(EZノーコミッション)', () => {
  it('バンカー勝ち 1:1', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(5, 2), ctx)).toBe(10000)
  })
  it('ドラゴン7(バンカー3枚合計7)ではバンカーベットはプッシュ', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(7, 3), ctx)).toBe(0)
    expect(isDragon7(bWin(7, 3))).toBe(true)
  })
  it('バンカー2枚合計7勝ちは通常勝ち(D7ではない)', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(7, 2), ctx)).toBe(10000)
  })
  it('タイ発生時のB/Pベットはプッシュ、タイベットは8:1(設定で9:1)', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, tie(6), ctx)).toBe(0)
    expect(settleBet({ target: 'P', amount: 10000 }, tie(6), ctx)).toBe(0)
    expect(settleBet({ target: 'T', amount: 10000 }, tie(6), ctx)).toBe(80000)
    expect(settleBet({ target: 'T', amount: 10000 }, tie(6), ctx9)).toBe(90000)
  })
})

describe('本線精算(コミッション式 0.95:1)', () => {
  it('バンカー勝ちは0.95倍', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(5, 2), ctxCom)).toBe(9500)
  })
  it('コミッション式ではバンカー3枚合計7勝ちもプッシュせず0.95倍', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(7, 3), ctxCom)).toBe(9500)
  })
  it('プレイヤー配当はplayerPayoutに従う', () => {
    const half = { ...ctxCom, mainBets: { ...COMMISSION, playerPayout: 0.9 } }
    expect(settleBet({ target: 'P', amount: 10000 }, pWin(8), half)).toBe(9000)
  })
})

describe('本線精算(スーパー6式:ノーコミッション・バンカー6勝ちは半額)', () => {
  const SUPER6: MainBetRules = { playerPayout: 1, bankerPayout: 1, bankerRule: 'super6', tiePayout: 8 }
  const ctxS6: SettleContext = { mainBets: SUPER6, sideBets: [] }
  it('バンカーが合計6で勝つと0.5倍払い(枚数不問)', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(6, 2), ctxS6)).toBe(5000)
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(6, 3), ctxS6)).toBe(5000)
  })
  it('6以外の勝ちは1:1(D7プッシュは適用されない)', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(7, 3), ctxS6)).toBe(10000)
    expect(settleBet({ target: 'B', amount: 10000 }, bWin(9, 2), ctxS6)).toBe(10000)
  })
  it('タイはプッシュ、負けは没収', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, tie(6), ctxS6)).toBe(0)
    expect(settleBet({ target: 'B', amount: 10000 }, pWin(8), ctxS6)).toBe(-10000)
  })
  it('スーパー6式ではバンカー勝ちの合計値が常に必須(半額判定に不可欠)', () => {
    expect(totalNeed('B', [], [], SUPER6)).toBe('required')
    expect(cardsNeed('B', 6, [], [], SUPER6)).toBe('none')
    expect(totalNeed('P', [], [], SUPER6)).toBe('none')
  })
})

describe('旧セッションとの後方互換', () => {
  it('mainBets の無い旧セッションはEZルール+当時のタイ配当として解釈される', () => {
    const rules = sessionRules({ tiePayout: 9 })
    expect(rules.bankerRule).toBe('ez')
    expect(rules.bankerPayout).toBe(1)
    expect(rules.tiePayout).toBe(9)
  })
})

describe('EZ標準サイドベット精算(旧プリセット)', () => {
  it('ドラゴン7 40:1 / バンカー6 12:1 / プレイヤー7 2枚6:1・3枚15:1 / パンダ8 25:1', () => {
    expect(settleBet({ target: 'D7', amount: 10000 }, bWin(7, 3), ctx)).toBe(400000)
    expect(settleBet({ target: 'D7', amount: 10000 }, bWin(7, 2), ctx)).toBe(-10000)
    expect(settleBet({ target: 'B6', amount: 10000 }, bWin(6, 3), ctx)).toBe(120000)
    expect(settleBet({ target: 'P7', amount: 10000 }, pWin(7, 2), ctx)).toBe(60000)
    expect(settleBet({ target: 'P7', amount: 10000 }, pWin(7, 3), ctx)).toBe(150000)
    expect(settleBet({ target: 'PANDA8', amount: 10000 }, pWin(8, 3), ctx)).toBe(250000)
  })
})

describe('カジノプリセット精算(INSPIRE)', () => {
  const inspire: SettleContext = {
    mainBets: casinoPreset('INSPIRE').mainBets,
    sideBets: casinoPreset('INSPIRE').sideBets,
  }
  it('ペア 11:1(P/B独立判定)・イーザーペア 5:1', () => {
    expect(settleBet({ target: 'P_PAIR', amount: 10000 }, bWin(5, 2, { pPair: true }), inspire)).toBe(110000)
    expect(settleBet({ target: 'P_PAIR', amount: 10000 }, bWin(5, 2, { pPair: false }), inspire)).toBe(-10000)
    expect(settleBet({ target: 'B_PAIR', amount: 10000 }, pWin(9, 2, { bPair: true }), inspire)).toBe(110000)
    expect(settleBet({ target: 'EITHER_PAIR', amount: 10000 }, { ...tie(5), pPair: false, bPair: true }, inspire)).toBe(50000)
  })
  it('ペア情報未入力(null)は不成立として没収', () => {
    expect(settleBet({ target: 'P_PAIR', amount: 10000 }, bWin(5, 2), inspire)).toBe(-10000)
  })
  it('Small/Big Dragon(P7の2枚/3枚)・Small/Big Tiger(B6の2枚/3枚)', () => {
    expect(settleBet({ target: 'SMALL_DRAGON', amount: 10000 }, pWin(7, 2), inspire)).toBe(150000)
    expect(settleBet({ target: 'BIG_DRAGON', amount: 10000 }, pWin(7, 3), inspire)).toBe(300000)
    expect(settleBet({ target: 'SMALL_DRAGON', amount: 10000 }, pWin(7, 3), inspire)).toBe(-10000)
    expect(settleBet({ target: 'SMALL_TIGER', amount: 10000 }, bWin(6, 2), inspire)).toBe(220000)
    expect(settleBet({ target: 'BIG_TIGER', amount: 10000 }, bWin(6, 3), inspire)).toBe(500000)
  })
  it('ドラゴンタイガー(P7がB6に勝つ)30:1・枚数不問', () => {
    expect(
      settleBet({ target: 'DRAGON_TIGER', amount: 10000 }, pWin(7, 2, { loserTotal: 6, loserCards: 2 }), inspire),
    ).toBe(300000)
    expect(
      settleBet({ target: 'DRAGON_TIGER', amount: 10000 }, pWin(7, 3, { loserTotal: 5 }), inspire),
    ).toBe(-10000)
  })
})

describe('カジノプリセット精算(PARADISE・Dragon Tiger枚数別配当)', () => {
  const paradise: SettleContext = {
    mainBets: casinoPreset('PARADISE').mainBets,
    sideBets: casinoPreset('PARADISE').sideBets,
  }
  const dt = (wc: 2 | 3, lc: 2 | 3) => pWin(7, wc, { loserTotal: 6, loserCards: lc })
  it('合計4枚=30:1 / 5枚=40:1 / 6枚=100:1', () => {
    expect(settleBet({ target: 'DRAGON_TIGER', amount: 10000 }, dt(2, 2), paradise)).toBe(300000)
    expect(settleBet({ target: 'DRAGON_TIGER', amount: 10000 }, dt(3, 2), paradise)).toBe(400000)
    expect(settleBet({ target: 'DRAGON_TIGER', amount: 10000 }, dt(2, 3), paradise)).toBe(400000)
    expect(settleBet({ target: 'DRAGON_TIGER', amount: 10000 }, dt(3, 3), paradise)).toBe(1000000)
  })
  it('枚数情報が欠けている場合は成立扱いにしない', () => {
    expect(
      settleBet({ target: 'DRAGON_TIGER', amount: 10000 }, pWin(7, 2, { loserTotal: 6, loserCards: null }), paradise),
    ).toBe(-10000)
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
})

describe('補助入力の要否判定', () => {
  const ezSides = presetSideBets() // D7/B6/P7 有効
  it('EZルールのバンカー勝ちは常に合計値必須、合計7は枚数必須', () => {
    expect(totalNeed('B', ezSides, [], EZ8)).toBe('required')
    expect(cardsNeed('B', 7, ezSides, [], EZ8)).toBe('required')
    expect(cardsNeed('B', 5, ezSides, [], EZ8)).toBe('none')
  })
  it('コミッション式+サイドベット全OFFなら追加入力は一切不要(最小タップ)', () => {
    const off = casinoPreset('INSPIRE').sideBets.map((d) => ({ ...d, enabled: false }))
    expect(totalNeed('B', off, [], COMMISSION)).toBe('none')
    expect(totalNeed('P', off, [], COMMISSION)).toBe('none')
    expect(pairNeed(off, [])).toBe('none')
  })
  it('ペアベット有効時のみペア入力が表示され、ベット中は必須', () => {
    const sides = casinoPreset('INSPIRE').sideBets
    expect(pairNeed(sides, [])).toBe('optional')
    expect(pairNeed(sides, [{ target: 'P_PAIR', amount: 10000 }])).toBe('required')
  })
  it('Dragon Tigerベット中はP勝ち合計7で負け側合計が必須(PARADISEは枚数も必須)', () => {
    const paradise = casinoPreset('PARADISE').sideBets
    const dtBet = [{ target: 'DRAGON_TIGER', amount: 10000 }]
    expect(loserNeed('P', 7, null, paradise, dtBet)).toEqual({ total: 'required', cards: 'required' })
    expect(loserNeed('P', 5, null, paradise, dtBet)).toEqual({ total: 'none', cards: 'none' })
    const inspire = casinoPreset('INSPIRE').sideBets
    expect(loserNeed('P', 7, null, inspire, dtBet)).toEqual({ total: 'required', cards: 'none' })
    expect(loserNeed('P', 7, null, inspire, [])).toEqual({ total: 'optional', cards: 'none' })
  })
  it('負け側合計が6以外(DT不成立確定)なら負け側枚数は要求しない', () => {
    const paradise = casinoPreset('PARADISE').sideBets
    const dtBet = [{ target: 'DRAGON_TIGER', amount: 10000 }]
    expect(loserNeed('P', 7, 3, paradise, dtBet)).toEqual({ total: 'required', cards: 'none' })
    expect(loserNeed('P', 7, 6, paradise, dtBet)).toEqual({ total: 'required', cards: 'required' })
  })
  it('合計値任意+枚数条件のカスタムベットは合計未入力でも枚数を必須にする', () => {
    const custom: ReturnType<typeof presetSideBets> = [
      {
        id: 'C1',
        name: 'バンカー3枚勝ち',
        side: 'B',
        rules: [{ totals: [], cards: '3', payout: 2 }],
        enabled: true,
      },
    ]
    const bet = [{ target: 'C1', amount: 10000 }]
    // 合計値は判定に不要(totals空)なので要求しないが、枚数は必須
    expect(totalNeed('B', custom, bet, COMMISSION)).toBe('none')
    expect(cardsNeed('B', null, custom, bet, COMMISSION)).toBe('required')
    expect(cardsNeed('B', null, custom, [], COMMISSION)).toBe('optional')
    // 枚数が入力されれば合計値なしでも正しく精算される
    const ctxC: SettleContext = { mainBets: COMMISSION, sideBets: custom }
    expect(settleBet({ target: 'C1', amount: 10000 }, bWin(5, 3), ctxC)).toBe(20000)
    expect(settleBet({ target: 'C1', amount: 10000 }, bWin(5, 2), ctxC)).toBe(-10000)
  })
  it('possibleMatch は「不成立確定」と「入力不足で判定不能」を区別する', () => {
    const d7 = presetSideBets().find((d) => d.id === 'D7')!
    expect(possibleMatch(d7, bWin(7, 3))).toBe(true) // 成立
    expect(possibleMatch(d7, bWin(7, null))).toBe(true) // 枚数不明 → 判定不能
    expect(possibleMatch(d7, bWin(6, 2))).toBe(false) // 不成立確定
    expect(possibleMatch(d7, pWin(7, 3))).toBe(false) // 勝者違い
    const pp = casinoPreset('INSPIRE').sideBets.find((d) => d.id === 'P_PAIR')!
    expect(possibleMatch(pp, bWin(5, 2))).toBe(true) // pPair未入力 → 判定不能
    expect(possibleMatch(pp, bWin(5, 2, { pPair: false }))).toBe(false)
  })
  it('タイガー系有効+ベット中はバンカー合計6の枚数が必須', () => {
    const sides = casinoPreset('INSPIRE').sideBets
    expect(cardsNeed('B', 6, sides, [{ target: 'SMALL_TIGER', amount: 10000 }], COMMISSION)).toBe('required')
    expect(cardsNeed('B', 6, sides, [], COMMISSION)).toBe('optional')
  })
})

describe('TIE MAX(タイ合計値レンジ別の独立ベット・PARADISE)', () => {
  const paradise: SettleContext = {
    mainBets: casinoPreset('PARADISE').mainBets,
    sideBets: casinoPreset('PARADISE').sideBets,
  }
  it('タイ0〜6は12:1、タイ7〜9は17:1(レンジ外・タイ以外は没収)', () => {
    expect(settleBet({ target: 'TIE_MAX_06', amount: 10000 }, tie(0), paradise)).toBe(120000)
    expect(settleBet({ target: 'TIE_MAX_06', amount: 10000 }, tie(6), paradise)).toBe(120000)
    expect(settleBet({ target: 'TIE_MAX_06', amount: 10000 }, tie(8), paradise)).toBe(-10000)
    expect(settleBet({ target: 'TIE_MAX_79', amount: 10000 }, tie(7), paradise)).toBe(170000)
    expect(settleBet({ target: 'TIE_MAX_79', amount: 10000 }, tie(9), paradise)).toBe(170000)
    expect(settleBet({ target: 'TIE_MAX_79', amount: 10000 }, tie(5), paradise)).toBe(-10000)
    expect(settleBet({ target: 'TIE_MAX_06', amount: 10000 }, bWin(5, 2), paradise)).toBe(-10000)
  })
  it('タイ発生時のB/Pプッシュは従来どおり', () => {
    expect(settleBet({ target: 'B', amount: 10000 }, tie(8), paradise)).toBe(0)
  })
  it('TIE MAXにベット中はタイ勝ちの合計値が必須', () => {
    const sides = casinoPreset('PARADISE').sideBets
    expect(totalNeed('T', sides, [{ target: 'TIE_MAX_06', amount: 10000 }], paradise.mainBets)).toBe('required')
    expect(totalNeed('T', sides, [], paradise.mainBets)).toBe('optional')
    expect(totalNeed('T', [], [{ target: 'T', amount: 10000 }], EZ8)).toBe('none')
  })
})
