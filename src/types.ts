/** 勝者(B=バンカー / P=プレイヤー / T=タイ) */
export type Winner = 'B' | 'P' | 'T'

/** 勝利ハンドの枚数条件 */
export type CardCondition = 'any' | '2' | '3'

/** サイドベットの成立条件1件。最初にマッチしたルールの配当が適用される */
export interface SideBetRule {
  /** 成立する勝利合計値(空配列 = 任意) */
  totals: number[]
  /** 勝利ハンドの枚数条件(タイ対象では 'any' のみ) */
  cards: CardCondition
  /** 配当倍率(40 = 40:1) */
  payout: number
}

export interface SideBetDef {
  id: string
  name: string
  /** どのサイドの勝利で成立するか */
  side: Winner
  rules: SideBetRule[]
  enabled: boolean
  preset?: boolean
}

/** 1ハンドに置いたベット1件。target は 'B'|'P'|'T' またはサイドベットid */
export interface BetPlacement {
  target: string
  amount: number
}

/** 結果入力(精算に必要な情報) */
export interface HandInput {
  winner: Winner
  /** 勝利合計値(タイの場合はタイの合計値)。不要な場合 null */
  winnerTotal: number | null
  /** 勝利ハンドの枚数。不要な場合 null */
  winnerCards: 2 | 3 | null
}

export interface Hand extends HandInput {
  id?: number
  sessionId: number
  seq: number
  ts: number
  /** 空配列 = 見(観戦) */
  bets: BetPlacement[]
  /** 精算結果(KRW、±) */
  net: number
}

export interface TableConfig {
  name: string
  tableMin: number
  tableMax: number
  tiePayout: 8 | 9
  sideBets: SideBetDef[]
}

export interface Session {
  id?: number
  startedAt: number
  endedAt: number | null
  startKrw: number
  tableMin: number
  tableMax: number
  tiePayout: 8 | 9
  sideBets: SideBetDef[]
  /** 資金がこの額以下になったらアラート(絶対額) */
  stopLossKrw: number | null
  /** 資金がこの額以上になったらアラート(絶対額) */
  takeProfitKrw: number | null
  /** セッション開始時レート(KRW per 1 JPY) */
  rate: number | null
  rateTs: number | null
  endKrw: number | null
  handCount: number | null
}

export interface RateInfo {
  /** 1円あたりのウォン(KRW per JPY) */
  rate: number
  ts: number
  source: 'api' | 'cache' | 'manual'
}

export interface Settings {
  key: string
  /** 推奨ベット率(% of 資金) */
  betPct: number
  /** チップ丸め単位(KRW) */
  chipUnit: number
  manualRate: number | null
  /** true: 手動レートを固定使用(自動更新しない) */
  manualRateFixed: boolean
  manualRateTs: number | null
  savedTables: TableConfig[]
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'settings',
  betPct: 1.5,
  chipUnit: 10_000,
  manualRate: null,
  manualRateFixed: false,
  manualRateTs: null,
  savedTables: [],
}
