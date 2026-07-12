import type { SideBetDef, Winner } from '../types'

/** シミュレーション用の結果分布(8デッキ完全列挙テーブルを圧縮したもの) */
export interface SimOutcome {
  winner: Winner
  wTotal: number
  wCards: 2 | 3
  prob: number
}

export type StrategyId =
  | 'flat'
  | 'martingale'
  | 'paroli'
  | 'cocomo'
  | 'montecarlo'
  | 'oneThreeTwoFour'
  | 'goodman'

export const STRATEGY_NAMES: Record<StrategyId, string> = {
  flat: 'フラットベット',
  martingale: 'マーチンゲール',
  paroli: 'パーレー(逆マーチン)',
  cocomo: 'ココモ法',
  montecarlo: 'モンテカルロ法',
  oneThreeTwoFour: '1-3-2-4法',
  goodman: 'グッドマン法(1-2-3-5)',
}

export interface SimRequest {
  runs: number
  handsPerRun: number
  startKrw: number
  baseBet: number
  tableMax: number
  strategy: StrategyId
  /** 本線ベット対象 */
  side: 'B' | 'P'
  tiePayout: 8 | 9
  /** 毎ハンド定額購入するサイドベット */
  sideBets: { def: SideBetDef; amount: number }[]
  outcomes: SimOutcome[]
}

export interface Histogram {
  min: number
  max: number
  binWidth: number
  bins: number[]
}

export interface SimProgress {
  type: 'progress'
  done: number
  total: number
}

export interface SimDone {
  type: 'done'
  /** 必要ベット額を用意できなくなった試行の割合 */
  ruinRate: number
  meanNet: number
  medianNet: number
  p05: number
  p95: number
  meanMaxDD: number
  ddP95: number
  meanHandsPlayed: number
  netHist: Histogram
  ddHist: Histogram
}

export type SimMessage = SimProgress | SimDone
