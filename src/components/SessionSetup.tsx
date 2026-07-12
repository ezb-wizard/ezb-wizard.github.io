import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { db } from '../lib/db'
import { casinoConfig, casinoPreset, CASINO_NAMES } from '../lib/casinos'
import { mainBetEdges } from '../lib/baccarat'
import type { MainBetRules, SideBetDef, StartInput } from '../types'
import { fmtBoth, fmtDateTime, fmtKrw, fmtPct } from '../lib/money'
import SideBetEditor from './SideBetEditor'
import { DecInput, Field, GhostBtn, NumInput, PrimaryBtn, Seg } from './ui'

type LimitMode = 'off' | 'amount' | 'pct'

export default function SessionSetup() {
  const { startSession, rate, settings, updateSettings } = useApp()
  const casino = settings.casino ?? 'PARADISE'

  const [startCcy, setStartCcy] = useState<'KRW' | 'JPY'>('KRW')
  const [startAmount, setStartAmount] = useState<number | null>(1_000_000)
  const [tableMin, setTableMin] = useState<number | null>(100_000)
  const [tableMax, setTableMax] = useState<number | null>(30_000_000)
  const [mainBets, setMainBets] = useState<MainBetRules>(() => casinoConfig(settings).mainBets)
  const [sideBets, setSideBets] = useState<SideBetDef[]>(() => casinoConfig(settings).sideBets)
  const [slMode, setSlMode] = useState<LimitMode>('off')
  const [slValue, setSlValue] = useState<number | null>(null)
  const [tpMode, setTpMode] = useState<LimitMode>('off')
  const [tpValue, setTpValue] = useState<number | null>(null)
  const [savedNote, setSavedNote] = useState(false)

  // カジノ切替で配当構成を読み直す(カスタム永続値 > プリセット)
  useEffect(() => {
    const c = casinoConfig(settings, casino)
    setMainBets(c.mainBets)
    setSideBets(c.sideBets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casino])

  // 前回セッションから開始資金のみ初期値に(テーブルmin/maxは既定値を維持)
  useEffect(() => {
    void (async () => {
      const last = await db.sessions.orderBy('startedAt').last()
      if (!last) return
      setStartAmount(last.startKrw)
    })()
  }, [])

  // JPY入力時はその日のレートでKRWへ自動換算
  const startKrw =
    startCcy === 'KRW'
      ? startAmount
      : startAmount != null && rate
        ? Math.round(startAmount * rate.rate)
        : null

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

  const edges = mainBetEdges(mainBets)
  const valid =
    startKrw != null &&
    startKrw > 0 &&
    tableMin != null &&
    tableMax != null &&
    tableMin > 0 &&
    tableMax >= tableMin

  const start = () => {
    if (!valid) return
    const startInput: StartInput = {
      currency: startCcy,
      amount: startAmount!,
      rate: startCcy === 'JPY' ? (rate?.rate ?? null) : null,
      rateTs: startCcy === 'JPY' ? (rate?.ts ?? null) : null,
    }
    void startSession({
      startKrw: startKrw!,
      tableMin: tableMin!,
      tableMax: tableMax!,
      tiePayout: mainBets.tiePayout === 9 ? 9 : 8,
      mainBets,
      casino,
      sideBets,
      stopLossKrw,
      takeProfitKrw,
      rate: rate?.rate ?? null,
      rateTs: rate?.ts ?? null,
      startInput,
    })
  }

  const saveAsCasinoDefault = () => {
    void updateSettings({
      casinoCustom: {
        ...(settings.casinoCustom ?? {}),
        [casino]: { mainBets: structuredClone(mainBets), sideBets: structuredClone(sideBets) },
      },
    })
    setSavedNote(true)
    setTimeout(() => setSavedNote(false), 2000)
  }

  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-gold-grad font-display text-lg font-bold">セッション開始</h1>
        <span className="rounded-full border border-gold-600/40 px-3 py-1 text-[11px] font-bold text-gold-300">
          {CASINO_NAMES[casino]}
        </span>
      </div>

      <Field label="開始資金">
        <div className="flex gap-2">
          <Seg
            className="w-28 shrink-0"
            options={[
              { value: 'KRW', label: '₩' },
              { value: 'JPY', label: '¥' },
            ]}
            value={startCcy}
            onChange={setStartCcy}
          />
          <NumInput
            value={startAmount}
            onChange={setStartAmount}
            placeholder={startCcy === 'KRW' ? '1,000,000' : '100,000'}
          />
        </div>
        {/* 換算プレビュー(リアルタイム) */}
        {startCcy === 'JPY' &&
          (rate ? (
            <span className="num mt-1 block text-right text-xs text-ink-2">
              {startAmount != null && (
                <>
                  ¥{startAmount.toLocaleString()} ≒ <b className="text-gold-300">{fmtKrw(startAmount * rate.rate)}</b>
                  <br />
                </>
              )}
              適用レート ¥1=₩{rate.rate.toFixed(2)}({fmtDateTime(rate.ts)} 時点
              {rate.source === 'cache' ? '・キャッシュ' : rate.source === 'manual' ? '・手動' : ''})
            </span>
          ) : (
            <span className="mt-1 block text-right text-xs font-bold text-lose">
              レート未取得のためJPY入力を使えません(設定画面で手動レートを入力してください)
            </span>
          ))}
        {startCcy === 'KRW' && startAmount != null && rate && (
          <span className="num mt-1 block text-right text-xs text-ink-2">{fmtBoth(startAmount, rate.rate)}</span>
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

      <Field label={`本線配当(${CASINO_NAMES[casino]})`}>
        <div className="card-luxe space-y-3 p-3">
          <div>
            <span className="mb-1 block text-[11px] text-ink-3">バンカー(ノーコミッション2方式+コミッション式)</span>
            <Seg
              options={[
                { value: 'super6', label: '6は半額' },
                { value: 'ez', label: 'EZ(D7押し)' },
                { value: 'commission', label: 'コミッション' },
              ]}
              value={mainBets.bankerRule}
              onChange={(v) =>
                setMainBets((m) => ({ ...m, bankerRule: v, bankerPayout: v === 'commission' ? 0.95 : 1 }))
              }
            />
            {mainBets.bankerRule === 'commission' ? (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs text-ink-2">配当</span>
                <DecInput
                  className="!h-10 !w-24"
                  value={mainBets.bankerPayout}
                  onChange={(v) => setMainBets((m) => ({ ...m, bankerPayout: v ?? 0.95 }))}
                />
                <span className="text-xs text-ink-2">:1</span>
              </div>
            ) : mainBets.bankerRule === 'ez' ? (
              <p className="mt-1 text-[10px] text-ink-3">1:1・ドラゴン7(バンカー3枚合計7勝ち)はプッシュ</p>
            ) : (
              <p className="mt-1 text-[10px] text-ink-3">
                1:1・バンカーが合計6で勝った場合は0.5倍(半額)払い ※タイガー系テーブルの標準
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs text-ink-2">プレイヤー</span>
            <DecInput
              className="!h-10 !w-24"
              value={mainBets.playerPayout}
              onChange={(v) => setMainBets((m) => ({ ...m, playerPayout: v ?? 1 }))}
            />
            <span className="text-xs text-ink-2">:1</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs text-ink-2">タイ</span>
            <Seg
              className="flex-1"
              options={[
                { value: 8, label: '8:1' },
                { value: 9, label: '9:1' },
              ]}
              value={mainBets.tiePayout as 8 | 9}
              onChange={(v) => setMainBets((m) => ({ ...m, tiePayout: v }))}
            />
          </div>
          <p className="num text-right text-[10px] text-ink-3">
            控除率:B {fmtPct(edges.banker)} / P {fmtPct(edges.player)} / T {fmtPct(edges.tie)}
          </p>
        </div>
      </Field>

      <Field label="サイドベット構成(配当はこの台の値に変更可)">
        <SideBetEditor defs={sideBets} onChange={setSideBets} />
      </Field>

      <div className="flex gap-2">
        <GhostBtn onClick={saveAsCasinoDefault}>
          {savedNote ? '✓ 保存しました' : 'このカジノの既定として保存'}
        </GhostBtn>
        <GhostBtn
          onClick={() => {
            const p = casinoPreset(casino)
            setMainBets(p.mainBets)
            setSideBets(p.sideBets)
          }}
        >
          プリセットに戻す
        </GhostBtn>
      </div>

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
