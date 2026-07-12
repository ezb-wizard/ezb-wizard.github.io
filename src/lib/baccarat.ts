import type { MainBetRules, Winner } from '../types'

/**
 * 8デッキ完全列挙による結果確率テーブル。
 * 最初の4枚はランク単位(13種×32枚)で列挙してペア(同ランク)を厳密に判定し、
 * 3枚目以降は値単位で列挙する(以降の判定は値のみに依存するため厳密性は保たれる)。
 */
export interface OutcomeBucket {
  winner: Winner
  pTotal: number
  bTotal: number
  pCards: 2 | 3
  bCards: 2 | 3
  /** プレイヤー最初の2枚が同ランク */
  pPair: boolean
  /** バンカー最初の2枚が同ランク */
  bPair: boolean
  prob: number
}

/** ランク→バカラ値(A=1, 2-9=数値, 10/J/Q/K=0) */
const RANK_VALUE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0]

/** バンカーの3枚目ドロー規則(プレイヤーが3枚目 p3 を引いた場合) */
function bankerDraws(bTotal: number, p3: number): boolean {
  if (bTotal <= 2) return true
  if (bTotal === 3) return p3 !== 8
  if (bTotal === 4) return p3 >= 2 && p3 <= 7
  if (bTotal === 5) return p3 >= 4 && p3 <= 7
  if (bTotal === 6) return p3 === 6 || p3 === 7
  return false
}

/** バケットの一意インデックス(pT,bT,pC,bC,pPair,bPair) */
function packIndex(pT: number, bT: number, pC: number, bC: number, pp: number, bp: number): number {
  return ((((pT * 10 + bT) * 2 + (pC - 2)) * 2 + (bC - 2)) * 2 + pp) * 2 + bp
}

export function computeOutcomeTable(decks = 8): OutcomeBucket[] {
  const rankCounts = new Array<number>(13).fill(4 * decks) // 各ランク32枚
  let remaining = 52 * decks
  const acc = new Float64Array(10 * 10 * 2 * 2 * 2 * 2)

  /** 3枚目用:現在のランク残数から値ごとの残数を作る */
  const valueCounts = (): number[] => {
    const v = new Array<number>(10).fill(0)
    for (let r = 0; r < 13; r++) v[RANK_VALUE[r]] += rankCounts[r]
    return v
  }

  /** ランク単位で1枚引く */
  const eachRank = (cb: (rank: number, p: number) => void) => {
    for (let r = 0; r < 13; r++) {
      if (rankCounts[r] === 0) continue
      const p = rankCounts[r] / remaining
      rankCounts[r]--
      remaining--
      cb(r, p)
      rankCounts[r]++
      remaining++
    }
  }

  eachRank((p1, q1) =>
    eachRank((b1, q2) =>
      eachRank((p2, q3) =>
        eachRank((b2, q4) => {
          const pt = (RANK_VALUE[p1] + RANK_VALUE[p2]) % 10
          const bt = (RANK_VALUE[b1] + RANK_VALUE[b2]) % 10
          const pp = p1 === p2 ? 1 : 0
          const bp = b1 === b2 ? 1 : 0
          const base = q1 * q2 * q3 * q4

          if (pt >= 8 || bt >= 8) {
            acc[packIndex(pt, bt, 2, 2, pp, bp)] += base // ナチュラル
            return
          }

          // 3枚目以降は値単位(without replacement)
          const vc = valueCounts()
          let rem3 = remaining

          if (pt <= 5) {
            for (let p3 = 0; p3 <= 9; p3++) {
              if (vc[p3] === 0) continue
              const q5 = vc[p3] / rem3
              const pt3 = (pt + p3) % 10
              if (bankerDraws(bt, p3)) {
                vc[p3]--
                rem3--
                for (let b3 = 0; b3 <= 9; b3++) {
                  if (vc[b3] === 0) continue
                  const q6 = vc[b3] / rem3
                  acc[packIndex(pt3, (bt + b3) % 10, 3, 3, pp, bp)] += base * q5 * q6
                }
                vc[p3]++
                rem3++
              } else {
                acc[packIndex(pt3, bt, 3, 2, pp, bp)] += base * q5
              }
            }
          } else if (bt <= 5) {
            for (let b3 = 0; b3 <= 9; b3++) {
              if (vc[b3] === 0) continue
              acc[packIndex(pt, (bt + b3) % 10, 2, 3, pp, bp)] += base * (vc[b3] / rem3)
            }
          } else {
            acc[packIndex(pt, bt, 2, 2, pp, bp)] += base
          }
        }),
      ),
    ),
  )

  const buckets: OutcomeBucket[] = []
  for (let pT = 0; pT <= 9; pT++)
    for (let bT = 0; bT <= 9; bT++)
      for (let pC = 2; pC <= 3; pC++)
        for (let bC = 2; bC <= 3; bC++)
          for (let pp = 0; pp <= 1; pp++)
            for (let bp = 0; bp <= 1; bp++) {
              const prob = acc[packIndex(pT, bT, pC, bC, pp, bp)]
              if (prob <= 0) continue
              buckets.push({
                winner: pT > bT ? 'P' : bT > pT ? 'B' : 'T',
                pTotal: pT,
                bTotal: bT,
                pCards: (pC === 2 ? 2 : 3) as 2 | 3,
                bCards: (bC === 2 ? 2 : 3) as 2 | 3,
                pPair: pp === 1,
                bPair: bp === 1,
                prob,
              })
            }
  return buckets
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
  /** プレイヤーペア(=バンカーペアと同値) */
  pPlayerPair: number
  pEitherPair: number
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
  let pPP = 0
  let pEP = 0
  for (const b of table) {
    if (b.winner === 'B') {
      pB += b.prob
      if (b.bTotal === 7 && b.bCards === 3) pD7 += b.prob
    } else if (b.winner === 'P') {
      pP += b.prob
      if (b.pTotal === 8 && b.pCards === 3) pP8 += b.prob
    } else {
      pT += b.prob
    }
    if (b.pPair) pPP += b.prob
    if (b.pPair || b.bPair) pEP += b.prob
  }
  cachedStats = {
    pBanker: pB,
    pPlayer: pP,
    pTie: pT,
    pDragon7: pD7,
    pPanda8: pP8,
    pPlayerPair: pPP,
    pEitherPair: pEP,
    // EZバンカー: D7でプッシュ、タイでプッシュ → EV = (pB - pD7) - pP
    edgeBankerEZ: pP - (pB - pD7),
    edgePlayer: pB - pP,
    edgeTie8: 1 - pT - 8 * pT,
    edgeTie9: 1 - pT - 9 * pT,
    edgeDragon7: 1 - pD7 - 40 * pD7,
  }
  return cachedStats
}

/** 本線ベットの控除率(配当ルールから動的算出) */
export function mainBetEdges(rules: MainBetRules): { banker: number; player: number; tie: number } {
  const t = getTheoreticalStats()
  const banker =
    rules.bankerRule === 'ez'
      ? t.pPlayer - (t.pBanker - t.pDragon7) * rules.bankerPayout
      : t.pPlayer - t.pBanker * rules.bankerPayout
  const player = t.pBanker - t.pPlayer * rules.playerPayout
  const tie = 1 - t.pTie - rules.tiePayout * t.pTie
  return { banker, player, tie }
}
