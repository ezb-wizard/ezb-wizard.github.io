import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { db } from '../lib/db'
import { presetSideBets } from '../lib/sidebets'
import type { SideBetDef, TableConfig } from '../types'
import { fmtBoth } from '../lib/money'
import SideBetEditor from './SideBetEditor'
import { Field, NumInput, PrimaryBtn, Seg } from './ui'

type LimitMode = 'off' | 'amount' | 'pct'

export default function SessionSetup() {
  const { startSession, rate, settings, updateSettings } = useApp()

  const [startKrw, setStartKrw] = useState<number | null>(1_000_000)
  const [tableMin, setTableMin] = useState<number | null>(10_000)
  const [tableMax, setTableMax] = useState<number | null>(1_000_000)
  const [tiePayout, setTiePayout] = useState<8 | 9>(8)
  const [sideBets, setSideBets] = useState<SideBetDef[]>(presetSideBets())
  const [slMode, setSlMode] = useState<LimitMode>('pct')
  const [slValue, setSlValue] = useState<number | null>(50)
  const [tpMode, setTpMode] = useState<LimitMode>('off')
  const [tpValue, setTpValue] = useState<number | null>(null)
  const [tableName, setTableName] = useState('')
  const [showSave, setShowSave] = useState(false)

  // 前回セッションの設定を初期値に
  useEffect(() => {
    void (async () => {
      const last = await db.sessions.orderBy('startedAt').last()
      if (!last) return
      setStartKrw(last.startKrw)
      setTableMin(last.tableMin)
      setTableMax(last.tableMax)
      setTiePayout(last.tiePayout)
      setSideBets(last.sideBets)
    })()
  }, [])

  const applyTable = (t: TableConfig) => {
    setTableMin(t.tableMin)
    setTableMax(t.tableMax)
    setTiePayout(t.tiePayout)
    setSideBets(structuredClone(t.sideBets))
  }

  const stopLossKrw =
    slMode === 'off' || startKrw == null || slValue == null
      ? null
      : slMode === 'amount'
        ? startKrw - slValue
        : Math.round(startKrw * (1 - slValue / 100))
  const takeProfitKrw =
    tpMode === 'off' || startKrw == null || tpValue == null
      ? null
      : tpMode === 'amount'
        ? startKrw + tpValue
        : Math.round(startKrw * (1 + tpValue / 100))

  const valid =
    startKrw != null &&
    startKrw > 0 &&
    tableMin != null &&
    tableMax != null &&
    tableMin > 0 &&
    tableMax >= tableMin

  const start = () => {
    if (!valid) return
    void startSession({
      startKrw: startKrw!,
      tableMin: tableMin!,
      tableMax: tableMax!,
      tiePayout,
      sideBets,
      stopLossKrw,
      takeProfitKrw,
      rate: rate?.rate ?? null,
      rateTs: rate?.ts ?? null,
    })
  }

  return (
    <div className="space-y-4 p-4 pb-8">
      <h1 className="text-lg font-bold text-gold-300">セッション開始</h1>

      {settings.savedTables.length > 0 && (
        <Field label="保存済みテーブルから読み込み">
          <div className="flex flex-wrap gap-2">
            {settings.savedTables.map((t) => (
              <button
                key={t.name}
                className="h-12 rounded-lg border border-felt-700 bg-felt-900 px-4 text-sm font-bold text-ink-2 active:bg-felt-800"
                onClick={() => applyTable(t)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="開始資金(KRW)">
        <NumInput value={startKrw} onChange={setStartKrw} placeholder="1,000,000" />
        {startKrw != null && rate && (
          <span className="num mt-1 block text-right text-xs text-ink-2">{fmtBoth(startKrw, rate.rate)}</span>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="テーブル最小(KRW)">
          <NumInput value={tableMin} onChange={setTableMin} />
        </Field>
        <Field label="テーブル最大(KRW)">
          <NumInput value={tableMax} onChange={setTableMax} />
        </Field>
      </div>

      <Field label="タイ配当">
        <Seg
          options={[
            { value: 8, label: '8:1' },
            { value: 9, label: '9:1' },
          ]}
          value={tiePayout}
          onChange={setTiePayout}
        />
      </Field>

      <Field label="サイドベット構成(配当はこのテーブルの値に変更)">
        <SideBetEditor defs={sideBets} onChange={setSideBets} />
      </Field>

      <LimitField
        label="ストップロス"
        mode={slMode}
        value={slValue}
        onMode={setSlMode}
        onValue={setSlValue}
        resultText={stopLossKrw != null ? `資金が ${fmtBoth(stopLossKrw, rate?.rate ?? null)} 以下で警告` : null}
      />
      <LimitField
        label="テイクプロフィット"
        mode={tpMode}
        value={tpValue}
        onMode={setTpMode}
        onValue={setTpValue}
        resultText={takeProfitKrw != null ? `資金が ${fmtBoth(takeProfitKrw, rate?.rate ?? null)} 以上で通知` : null}
      />

      <div>
        {showSave ? (
          <div className="flex gap-2">
            <input
              type="text"
              className="h-12 flex-1 rounded-lg border border-felt-700 bg-felt-950 px-3 text-ink focus:border-gold-500 focus:outline-none"
              placeholder="テーブル名(例: パラダイス1番)"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
            <button
              className="h-12 rounded-lg bg-gold-500 px-4 text-sm font-bold text-felt-950 disabled:opacity-40"
              disabled={!tableName.trim() || !valid}
              onClick={() => {
                const t: TableConfig = {
                  name: tableName.trim(),
                  tableMin: tableMin!,
                  tableMax: tableMax!,
                  tiePayout,
                  sideBets: structuredClone(sideBets),
                }
                void updateSettings({
                  savedTables: [...settings.savedTables.filter((x) => x.name !== t.name), t],
                })
                setTableName('')
                setShowSave(false)
              }}
            >
              保存
            </button>
          </div>
        ) : (
          <button className="text-xs font-bold text-gold-400 underline" onClick={() => setShowSave(true)}>
            この構成をテーブル設定として保存
          </button>
        )}
      </div>

      <PrimaryBtn onClick={start} disabled={!valid}>
        セッション開始
      </PrimaryBtn>
    </div>
  )
}

function LimitField({
  label,
  mode,
  value,
  onMode,
  onValue,
  resultText,
}: {
  label: string
  mode: LimitMode
  value: number | null
  onMode: (m: LimitMode) => void
  onValue: (v: number | null) => void
  resultText: string | null
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Seg
          className="flex-1"
          options={[
            { value: 'off', label: 'なし' },
            { value: 'amount', label: '額' },
            { value: 'pct', label: '%' },
          ]}
          value={mode}
          onChange={onMode}
        />
        <NumInput
          value={value}
          onChange={onValue}
          className="!w-32"
          disabled={mode === 'off'}
          placeholder={mode === 'pct' ? '50' : '500,000'}
        />
      </div>
      {resultText && <span className="num mt-1 block text-right text-xs text-ink-2">{resultText}</span>}
    </Field>
  )
}
