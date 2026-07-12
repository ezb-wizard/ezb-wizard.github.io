import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { getOutcomeTable } from '../lib/baccarat'
import { casinoConfig } from '../lib/casinos'
import { sessionRules } from '../types'
import {
  STRATEGY_NAMES,
  type SimDone,
  type SimMessage,
  type SimRequest,
  type StrategyId,
} from '../lib/simTypes'
import { fmtKrw, fmtPct, fmtSigned } from '../lib/money'
import { HistChart } from './charts'
import { Field, NumInput, PrimaryBtn, Seg } from './ui'

/** 戦略シミュレーター(実プレイと分離した教育用タブ) */
export default function SimScreen() {
  const { session, settings } = useApp()
  const mainBets = session ? sessionRules(session) : casinoConfig(settings).mainBets
  const availableSides = (session?.sideBets ?? casinoConfig(settings).sideBets).filter((d) => d.enabled)

  const [strategy, setStrategy] = useState<StrategyId>('flat')
  const [side, setSide] = useState<'B' | 'P'>('B')
  const [startKrw, setStartKrw] = useState<number | null>(1_000_000)
  const [baseBet, setBaseBet] = useState<number | null>(settings.chipUnit)
  const [tableMax, setTableMax] = useState<number | null>(session?.tableMax ?? 1_000_000)
  const [handsPerRun, setHandsPerRun] = useState<number | null>(100)
  const [runs, setRuns] = useState<number | null>(10_000)
  const [sideAmounts, setSideAmounts] = useState<Record<string, number>>({})

  const [progress, setProgress] = useState<number | null>(null)
  const [result, setResult] = useState<SimDone | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => () => workerRef.current?.terminate(), [])

  const valid =
    startKrw != null &&
    baseBet != null &&
    tableMax != null &&
    handsPerRun != null &&
    runs != null &&
    startKrw > 0 &&
    baseBet > 0 &&
    handsPerRun > 0 &&
    runs >= 1000

  const run = () => {
    if (!valid) return
    workerRef.current?.terminate()
    const worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    setResult(null)
    setProgress(0)

    const req: SimRequest = {
      runs: runs!,
      handsPerRun: handsPerRun!,
      startKrw: startKrw!,
      baseBet: baseBet!,
      tableMax: tableMax!,
      strategy,
      side,
      mainBets,
      sideBets: availableSides
        .filter((d) => (sideAmounts[d.id] ?? 0) > 0)
        .map((d) => ({ def: d, amount: sideAmounts[d.id] })),
      outcomes: getOutcomeTable(),
    }
    worker.onmessage = (e: MessageEvent<SimMessage>) => {
      if (e.data.type === 'progress') setProgress(e.data.done / e.data.total)
      else {
        setResult(e.data)
        setProgress(null)
        worker.terminate()
      }
    }
    worker.postMessage(req)
  }

  return (
    <div className="space-y-4 p-3 pb-8">
      <div className="card-luxe p-3 text-[11px] leading-relaxed text-ink-2">
        ここは<b className="text-ink">教育用シミュレーター</b>です。どのベット法も期待値(控除率)は変えられません。
        破産リスクと収支のばらつきがどう変わるかを確認するためのツールです。
      </div>

      <Field label="戦略">
        <select
          className="h-12 w-full rounded-lg border border-base-700 bg-base-950 px-3 text-ink focus:border-gold-500 focus:outline-none"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as StrategyId)}
        >
          {Object.entries(STRATEGY_NAMES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="本線ベット対象">
        <Seg
          options={[
            { value: 'B', label: 'バンカー' },
            { value: 'P', label: 'プレイヤー' },
          ]}
          value={side}
          onChange={setSide}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="開始資金(KRW)">
          <NumInput value={startKrw} onChange={setStartKrw} />
        </Field>
        <Field label="ベース額(KRW)">
          <NumInput value={baseBet} onChange={setBaseBet} />
        </Field>
        <Field label="テーブル最大(KRW)">
          <NumInput value={tableMax} onChange={setTableMax} />
        </Field>
        <Field label="1試行のハンド数">
          <NumInput value={handsPerRun} onChange={setHandsPerRun} />
        </Field>
        <Field label="試行回数(1万以上推奨)">
          <NumInput value={runs} onChange={setRuns} />
        </Field>
      </div>

      {availableSides.length > 0 && (
        <Field label="サイドベット毎ハンド購入(0 = 購入しない)">
          <div className="space-y-2">
            {availableSides.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <span className="w-28 text-xs text-ink-2">{d.name}</span>
                <NumInput
                  value={sideAmounts[d.id] ?? null}
                  onChange={(v) => setSideAmounts((a) => ({ ...a, [d.id]: v ?? 0 }))}
                  className="!h-10"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </Field>
      )}

      <PrimaryBtn onClick={run} disabled={!valid || progress != null}>
        {progress != null ? `計算中… ${Math.round(progress * 100)}%` : 'シミュレーション実行'}
      </PrimaryBtn>
      {progress != null && (
        <div className="h-2 overflow-hidden rounded-full bg-base-800">
          <div className="h-full bg-gold-500 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {result && <SimResults result={result} runs={runs ?? 0} />}
    </div>
  )
}

function SimResults({ result, runs }: { result: SimDone; runs: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ResultCard label="破産確率(必要ベット不能)">
          <span className={`num text-xl font-bold ${result.ruinRate > 0.1 ? 'text-lose' : ''}`}>
            {fmtPct(result.ruinRate)}
          </span>
        </ResultCard>
        <ResultCard label="期待収支(平均)">
          <span className={`num text-xl font-bold ${result.meanNet < 0 ? 'text-lose' : 'text-win'}`}>
            {fmtSigned(result.meanNet)}
          </span>
        </ResultCard>
        <ResultCard label="中央値 / 5%〜95%">
          <span className="num text-sm font-bold">{fmtSigned(result.medianNet)}</span>
          <span className="num block text-[10px] text-ink-2">
            {fmtSigned(result.p05)} 〜 {fmtSigned(result.p95)}
          </span>
        </ResultCard>
        <ResultCard label="最大DD 平均 / 95%">
          <span className="num text-sm font-bold text-lose">-{fmtKrw(result.meanMaxDD)}</span>
          <span className="num block text-[10px] text-ink-2">95%: -{fmtKrw(result.ddP95)}</span>
        </ResultCard>
      </div>

      <div className="card-luxe p-3">
        <h3 className="mb-1 text-xs font-bold text-gold-300">最終収支の分布({runs.toLocaleString()}試行)</h3>
        <HistChart hist={result.netHist} xFmt={(v) => fmtKrw(v)} />
      </div>
      <div className="card-luxe p-3">
        <h3 className="mb-1 text-xs font-bold text-gold-300">最大ドローダウンの分布</h3>
        <HistChart hist={result.ddHist} xFmt={(v) => fmtKrw(v)} />
      </div>
      <p className="text-[10px] leading-relaxed text-ink-3">
        平均プレイハンド数 {result.meanHandsPlayed.toFixed(1)}。「破産」は次の必要ベット額(サイドベット含む)を
        用意できなくなった時点を指します。期待収支がマイナスである事実はどの戦略でも変わりません。
      </p>
    </div>
  )
}

function ResultCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card-luxe p-2.5">
      <div className="text-[10px] text-ink-3">{label}</div>
      {children}
    </div>
  )
}
