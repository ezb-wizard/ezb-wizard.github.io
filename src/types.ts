/** 勝者(B=バンカー / P=プレイヤー / T=タイ) */
export type Winner = 'B' | 'P' | 'T'

/** 勝利ハンドの枚数条件 */
export type CardCondition = 'any' | '2' | '3'

export type CasinoId = 'PARADISE' | 'INSPIRE'

/**
 * 本線ベットの配当ルール。bankerRule:
 * - 'ez' = ノーコミッション(1:1・ドラゴン7でプッシュ)
 * - 'super6' = ノーコミッション(1:1・バンカーが合計6で勝つと0.5倍払い。タイガー系テーブルの標準)
 * - 'commission' = bankerPayout倍(例0.95)
 */
export interface MainBetRules {
  playerPayout: number
  bankerPayout: number
  bankerRule: 'ez' | 'commission' | 'super6'
  tiePayout: number
  /**
   * false = 本線タイベットが存在しないテーブル(PARADISEのTIE MAX等、
   * タイは合計値レンジ別のサイドベットとして提供される)。未設定 = あり
   */
  tieEnabled?: boolean
}

export const EZ_MAIN_BETS: MainBetRules = {
  playerPayout: 1,
  bankerPayout: 1,
  bankerRule: 'ez',
  tiePayout: 8,
}

/** サイドベットの成立条件1件。最初にマッチしたルールの配当が適用される */
export interface SideBetRule {
  /** 成立する勝利合計値(空配列 = 任意) */
  totals: number[]
  /** 勝利ハンドの枚数条件(タイ対象では 'any' のみ) */
  cards: CardCondition
  /** 配当倍率(40 = 40:1) */
  payout: number
  /** 負け側合計値の条件(Dragon Tiger等。省略 = 条件なし) */
  loserTotals?: number[]
  /** 両ハンド合計枚数の条件(PARADISEのDragon Tiger 4/5/6枚。省略 = 条件なし) */
  totalCards?: number[]
}

export interface SideBetDef {
  id: string
  name: string
  /** どのサイドの勝利で成立するか(pairTarget指定時は未使用) */
  side: Winner
  /** ペア系ベット:勝者と無関係に最初の2枚のペアで判定 */
  pairTarget?: 'P' | 'B' | 'either'
  rules: SideBetRule[]
  enabled: boolean
  preset?: boolean
}

/** 1ハンドに置いたベット1件。target は 'B'|'P'|'T' またはサイドベットid */
export interface BetPlacement {
  target: string
  amount: number
}

/** 結果入力(精算に必要な情報)。不要・未入力の項目は null(旧データは undefined) */
export interface HandInput {
  winner: Winner
  /** 勝利合計値(タイの場合はタイの合計値) */
  winnerTotal: number | null
  /** 勝利ハンドの枚数 */
  winnerCards: 2 | 3 | null
  /** 負け側の合計値(Dragon Tiger判定用) */
  loserTotal?: number | null
  /** 負け側の枚数(Dragon Tigerの合計枚数配当用) */
  loserCards?: 2 | 3 | null
  /** プレイヤー最初の2枚がペア */
  pPair?: boolean | null
  /** バンカー最初の2枚がペア */
  bPair?: boolean | null
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

/** カジノごとの配当構成(プリセット or カスタム永続化) */
export interface CasinoConfig {
  mainBets: MainBetRules
  sideBets: SideBetDef[]
}

export interface TableConfig {
  name: string
  tableMin: number
  tableMax: number
  tiePayout: 8 | 9
  sideBets: SideBetDef[]
}

/** 開始資金の入力記録(JPY入力時の換算根拠) */
export interface StartInput {
  currency: 'KRW' | 'JPY'
  amount: number
  /** 換算に使ったレート(KRW per JPY)。KRW入力時は null */
  rate: number | null
  rateTs: number | null
}

export interface Session {
  id?: number
  startedAt: number
  endedAt: number | null
  startKrw: number
  tableMin: number
  tableMax: number
  /** 旧フィールド(後方互換)。新コードは mainBets.tiePayout を使用 */
  tiePayout: 8 | 9
  /** セッション開始時の配当スナップショット(後から設定を変えても過去の損益は不変) */
  mainBets?: MainBetRules
  casino?: CasinoId | null
  sideBets: SideBetDef[]
  /** 資金がこの額以下になったらアラート(絶対額) */
  stopLossKrw: number | null
  /** 資金がこの額以上になったらアラート(絶対額) */
  takeProfitKrw: number | null
  /** セッション開始時レート(KRW per 1 JPY) */
  rate: number | null
  rateTs: number | null
  startInput?: StartInput | null
  endKrw: number | null
  handCount: number | null
}

/** 旧セッションとの後方互換:mainBets が無い場合はEZルール+当時のタイ配当 */
export function sessionRules(s: Pick<Session, 'mainBets' | 'tiePayout'>): MainBetRules {
  return s.mainBets ?? { ...EZ_MAIN_BETS, tiePayout: s.tiePayout }
}

export interface RateInfo {
  /** 1円あたりのウォン(KRW per JPY) */
  rate: number
  ts: number
  source: 'api' | 'cache' | 'manual'
}

export interface Settings {
  key: string
  /** 選択中のカジノ */
  casino?: CasinoId
  /** カジノごとのカスタム配当構成(未編集のカジノはプリセットを使用) */
  casinoCustom?: Partial<Record<CasinoId, CasinoConfig>>
  /** 推奨ベット率(% of 資金、1〜10) */
  betPct: number
  /** チップ丸め単位(KRW) */
  chipUnit: number
  /** ベットチッププリセット(KRW・4種) */
  chipPresets?: number[]
  /** クイック登録:精算に必須の入力だけを求め、省略可の入力は自動スキップ */
  quickMode?: boolean
  manualRate: number | null
  /** true: 手動レートを固定使用(自動更新しない) */
  manualRateFixed: boolean
  manualRateTs: number | null
  savedTables: TableConfig[]
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'settings',
  casino: 'PARADISE',
  casinoCustom: {},
  betPct: 1.5,
  chipUnit: 10_000,
  chipPresets: [100_000, 500_000, 1_000_000, 5_000_000],
  quickMode: true,
  manualRate: null,
  manualRateFixed: false,
  manualRateTs: null,
  savedTables: [],
}
