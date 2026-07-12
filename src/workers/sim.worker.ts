/// <reference lib="webworker" />
import { settleBet } from '../lib/settle'
import { bucketToHand } from '../lib/sidebets'
import type { HandInput } from '../types'
import type { Histogram, SimDone, SimMessage, SimRequest, StrategyId } from '../lib/simTypes'

/**
 * 戦略シミュレーター(モンテカルロ)。UIをブロックしないようWorkerで実行。
 * EZバカラの配当ルール(ドラゴン7プッシュ含む)は本番と同じ settleBet を使用。
 */

interface Strategy {
  next(): number
  onResult(r: 'win' | 'loss' | 'push'): void
}

function makeStrategy(id: StrategyId, base: number): Strategy {
  switch (id) {
    case 'flat':
      return { next: () => base, onResult: () => {} }
    case 'martingale': {
      let mult = 1
      return {
        next: () => base * mult,
        onResult: (r) => {
          if (r === 'loss') mult *= 2
          else if (r === 'win') mult = 1
        },
      }
    }
    case 'paroli': {
      // 勝ったら倍賭け、3連勝でリセット
      let streak = 0
      return {
        next: () => base * 2 ** streak,
        onResult: (r) => {
          if (r === 'win') streak = (streak + 1) % 3
          else if (r === 'loss') streak = 0
        },
      }
    }
    case 'cocomo': {
      // 負けたら直前2回の合計(1,1,2,3,5,…)、勝ったらリセット
      let hist = [1]
      return {
        next: () => base * hist[hist.length - 1],
        onResult: (r) => {
          if (r === 'loss') {
            hist.push(hist.length < 2 ? 1 : hist[hist.length - 1] + hist[hist.length - 2])
          } else if (r === 'win') {
            hist = [1]
          }
        },
      }
    }
    case 'montecarlo': {
      // 数列[1,2,3]、ベット=両端の和。負けたら数列末尾に追加、勝ったら両端を消す
      let seq = [1, 2, 3]
      const bet = () => (seq.length >= 2 ? seq[0] + seq[seq.length - 1] : seq[0] ?? 1)
      return {
        next: () => base * bet(),
        onResult: (r) => {
          if (r === 'loss') {
            seq.push(bet())
          } else if (r === 'win') {
            seq = seq.slice(1, -1)
            if (seq.length <= 1) seq = [1, 2, 3]
          }
        },
      }
    }
    case 'oneThreeTwoFour': {
      const steps = [1, 3, 2, 4]
      let i = 0
      return {
        next: () => base * steps[i],
        onResult: (r) => {
          if (r === 'win') i = (i + 1) % 4
          else if (r === 'loss') i = 0
        },
      }
    }
    case 'goodman': {
      const steps = [1, 2, 3, 5]
      let i = 0
      return {
        next: () => base * steps[i],
        onResult: (r) => {
          if (r === 'win') i = Math.min(i + 1, 3)
          else if (r === 'loss') i = 0
        },
      }
    }
  }
}

function histogram(values: number[], binCount = 24): Histogram {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return { min, max: max + 1, binWidth: 1, bins: [values.length] }
  const binWidth = (max - min) / binCount
  const bins = Array.from({ length: binCount }, () => 0)
  for (const v of values) {
    const i = Math.min(binCount - 1, Math.floor((v - min) / binWidth))
    bins[i]++
  }
  return { min, max, binWidth, bins }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))
  return sorted[idx]
}

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const req = e.data
  const post = (m: SimMessage) => (self as unknown as Worker).postMessage(m)

  // 累積確率(二分探索用)
  const cum: number[] = []
  let acc = 0
  for (const o of req.outcomes) {
    acc += o.prob
    cum.push(acc)
  }
  const sample = (): HandInput => {
    const u = Math.random() * acc
    let lo = 0
    let hi = cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid] < u) lo = mid + 1
      else hi = mid
    }
    return bucketToHand(req.outcomes[lo])
  }

  const ctx = { mainBets: req.mainBets, sideBets: req.sideBets.map((s) => s.def) }
  const sideTotal = req.sideBets.reduce((s, b) => s + b.amount, 0)

  const finals: number[] = []
  const maxDDs: number[] = []
  let ruinCount = 0
  let totalHands = 0

  for (let run = 0; run < req.runs; run++) {
    let bankroll = req.startKrw
    let peak = bankroll
    let maxDD = 0
    const strat = makeStrategy(req.strategy, req.baseBet)
    let ruined = false

    for (let h = 0; h < req.handsPerRun; h++) {
      const bet = Math.min(strat.next(), req.tableMax)
      if (bankroll < bet + sideTotal) {
        ruined = true
        break
      }
      const hand = sample()
      const mainNet = settleBet({ target: req.side, amount: bet }, hand, ctx)
      let net = mainNet
      for (const sb of req.sideBets) {
        net += settleBet({ target: sb.def.id, amount: sb.amount }, hand, ctx)
      }
      bankroll += net
      totalHands++
      strat.onResult(mainNet > 0 ? 'win' : mainNet < 0 ? 'loss' : 'push')
      if (bankroll > peak) peak = bankroll
      if (peak - bankroll > maxDD) maxDD = peak - bankroll
    }

    finals.push(bankroll - req.startKrw)
    maxDDs.push(maxDD)
    if (ruined) ruinCount++
    if ((run + 1) % 500 === 0) post({ type: 'progress', done: run + 1, total: req.runs })
  }

  const sorted = [...finals].sort((a, b) => a - b)
  const sortedDD = [...maxDDs].sort((a, b) => a - b)
  const result: SimDone = {
    type: 'done',
    ruinRate: ruinCount / req.runs,
    meanNet: finals.reduce((s, v) => s + v, 0) / finals.length,
    medianNet: percentile(sorted, 0.5),
    p05: percentile(sorted, 0.05),
    p95: percentile(sorted, 0.95),
    meanMaxDD: maxDDs.reduce((s, v) => s + v, 0) / maxDDs.length,
    ddP95: percentile(sortedDD, 0.95),
    meanHandsPlayed: totalHands / req.runs,
    netHist: histogram(finals),
    ddHist: histogram(maxDDs),
  }
  post(result)
}
