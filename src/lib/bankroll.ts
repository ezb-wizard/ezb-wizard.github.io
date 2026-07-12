/** 資金管理:推奨ベット額・ストップロス関連の計算 */

export interface RecommendedBet {
  /** チップ単位に丸めた推奨額(資金 × 設定率) */
  amount: number
  /** 推奨額がテーブルmin未満 → テーブル離脱推奨 */
  leaveTable: boolean
}

export function recommendedBet(
  bankroll: number,
  betPct: number,
  chipUnit: number,
  tableMin: number,
): RecommendedBet {
  const raw = (bankroll * betPct) / 100
  const rounded = Math.max(chipUnit, Math.round(raw / chipUnit) * chipUnit)
  return { amount: rounded, leaveTable: rounded < tableMin || bankroll < tableMin }
}

/** 推奨額で賭け続けた場合、あと何連敗でストップロスに到達するか */
export function lossesToStopLoss(
  bankroll: number,
  stopLossKrw: number | null,
  betAmount: number,
): number | null {
  if (stopLossKrw == null || betAmount <= 0) return null
  if (bankroll <= stopLossKrw) return 0
  return Math.ceil((bankroll - stopLossKrw) / betAmount)
}
