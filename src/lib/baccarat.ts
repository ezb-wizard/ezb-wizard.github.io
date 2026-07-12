import type { Winner } from '../types'

/**
 * 8デッキ完全列挙による結果確率テーブル。
 * 勝者 × 勝利合計値 × 勝利ハンド枚数(タイは両ハンド枚数を保持)ごとの厳密な確率。
 */
export interface OutcomeBucket {
  winner: Winner
  /** 勝利側の合計値(タイの場合はタイ合計値) */
  wTotal: number
  /** 勝利側の枚数(タイの場合はプレイヤー側の枚数。タイ系判定では使用しない) */
  wCards: 2 | 3
  prob: number
}

/** バンカーの3枚目ドロー規則(プレイヤーが3枚目 p3 を引いた場合) */
function bankerDraws(bTotal: number, p3: number): boolean {
  if (bTotal <= 2) return true
  if (bTotal === 3) return p3 !== 8
  if (bTotal === 4) return p3 >= 2 && p3 <= 7
  if (bTotal === 5) return p3 >= 4 && p3 <= 7
  if (bTotal === 6) return p3 === 6 || p3 === 7
  return false
}

/** 8デッキシューを完全列挙し、終局ごとの厳密確率を集計する(初回 ~100ms) */
export function computeOutcomeTable(decks = 8): OutcomeBucket[] {
  // 値0(10/J/Q/K)は各デッキ16枚、値1〜9は各4枚
  const counts = [16 * decks, ...Array.from({ length: 9 }, () => 4 * decks)]
  let remaining = 52 * decks

  const acc = new Map<string, OutcomeBucket>()
  const settle = (pT: number, bT: number, pC: 2 | 3, bC: 2 | 3, prob: number) => {
    const winner: Winner = pT > bT ? 'P' : bT > pT ? 'B' : 'T'
    const wTotal = winner === 'B' ? bT : pT
    const wCards = winner === 'B' ? bC : pC
    const key = `${winner}|${wTotal}|${wCards}`
    const b = acc.get(key)
    if (b) b.prob += prob
    else acc.set(key, { winner, wTotal, wCards, prob })
  }

  /** シューから1枚引く各値の確率で cb を呼ぶ(呼出し中はカウントを減算) */
  const each = (cb: (v: number, p: number) => void) => {
    for (let v = 0; v <= 9; v++) {
      if (counts[v] === 0) continue
      const p = counts[v] / remaining
      counts[v]--
      remaining--
      cb(v, p)
      counts[v]++
      remaining++
    }
  }

  each((p1, q1) =>
    each((b1, q2) =>
      each((p2, q3) =>
        each((b2, q4) => {
          const pt = (p1 + p2) % 10
          const bt = (b1 + b2) % 10
          const base = q1 * q2 * q3 * q4
          if (pt >= 8 || bt >= 8) {
            settle(pt, bt, 2, 2, base) // ナチュラル
            return
          }
          if (pt <= 5) {
            each((p3, q5) => {
              const pt3 = (pt + p3) % 10
              if (bankerDraws(bt, p3)) {
                each((b3, q6) => settle(pt3, (bt + b3) % 10, 3, 3, base * q5 * q6))
              } else {
                settle(pt3, bt, 3, 2, base * q5)
              }
            })
          } else if (bt <= 5) {
            each((b3, q5) => settle(pt, (bt + b3) % 10, 2, 3, base * q5))
          } else {
            settle(pt, bt, 2, 2, base)
          }
        }),
      ),
    ),
  )

  return [...acc.values()]
}

let cachedTable: OutcomeBucket[] | null = null

/** 結果確率テーブル(メモ化) */
export function getOutcomeTable(): OutcomeBucket[] {
  if (!cachedTable) cachedTable = computeOutcomeTable(8)
  return cachedTable
}

export interface TheoreticalStats {
  pBanker: number
  pPlayer: number
  pTie: number
  /** ドラゴン7(バンカー3枚合計7勝ち) */
  pDragon7: number
  /** パンダ8(プレイヤー3枚合計8勝ち) */
  pPanda8: number
  /** EZバンカー(D7プッシュ)の控除率 */
  edgeBankerEZ: number
  edgePlayer: number
  edgeTie8: number
  edgeTie9: number
  edgeDragon7: number
}

let cachedStats: TheoreticalStats | null = null

export function getTheoreticalStats(): TheoreticalStats {
  if (cachedStats) return cachedStats
  const table = getOutcomeTable()
  let pB = 0
  let pP = 0
  let pT = 0
  let pD7 = 0
  let pP8 = 0
  for (const b of table) {
    if (b.winner === 'B') {
      pB += b.prob
      if (b.wTotal === 7 && b.wCards === 3) pD7 += b.prob
    } else if (b.winner === 'P') {
      pP += b.prob
      if (b.wTotal === 8 && b.wCards === 3) pP8 += b.prob
    } else {
      pT += b.prob
    }
  }
  cachedStats = {
    pBanker: pB,
    pPlayer: pP,
    pTie: pT,
    pDragon7: pD7,
    pPanda8: pP8,
    // EZバンカー: D7でプッシュ、タイでプッシュ → EV = (pB - pD7) - pP
    edgeBankerEZ: pP - (pB - pD7),
    edgePlayer: pB - pP,
    edgeTie8: 1 - pT - 8 * pT,
    edgeTie9: 1 - pT - 9 * pT,
    edgeDragon7: 1 - pD7 - 40 * pD7,
  }
  return cachedStats
}
