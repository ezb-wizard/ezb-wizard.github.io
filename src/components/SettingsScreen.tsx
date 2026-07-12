import { useState } from 'react'
import { useApp } from '../store'
import { exportCsv, exportJson } from '../lib/export'
import { fmtDateTime } from '../lib/money'
import { DecInput, Field, GhostBtn, Seg } from './ui'

export default function SettingsScreen() {
  const { settings, updateSettings, rate, refreshRate } = useApp()
  const [manualRate, setManualRate] = useState<number | null>(settings.manualRate)
  const [refreshing, setRefreshing] = useState(false)

  return (
    <div className="space-y-5 p-4 pb-8">
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gold-300">資金管理</h2>
        <Field label={`推奨ベット率:資金の ${settings.betPct}%(1〜3%)`}>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={settings.betPct}
            className="h-12 w-full accent-[#c9a24b]"
            onChange={(e) => void updateSettings({ betPct: Number(e.target.value) })}
          />
        </Field>
        <Field label="チップ丸め単位(KRW)">
          <Seg
            options={[
              { value: 5_000, label: '5千' },
              { value: 10_000, label: '1万' },
              { value: 25_000, label: '2.5万' },
              { value: 50_000, label: '5万' },
            ]}
            value={settings.chipUnit}
            onChange={(v) => void updateSettings({ chipUnit: v })}
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gold-300">為替レート(JPY/KRW)</h2>
        <div className="rounded-lg border border-felt-700 bg-felt-900 p-3 text-sm">
          {rate ? (
            <>
              <div className="num font-bold">¥1 = ₩{rate.rate.toFixed(4)}</div>
              <div className="text-[11px] text-ink-3">
                {fmtDateTime(rate.ts)} 時点(
                {rate.source === 'api' ? 'オンライン取得' : rate.source === 'cache' ? 'キャッシュ' : '手動入力'})
              </div>
            </>
          ) : (
            <span className="text-ink-3">未取得(オフライン時は手動入力を使用)</span>
          )}
        </div>
        <GhostBtn
          onClick={() => {
            setRefreshing(true)
            void refreshRate().finally(() => setRefreshing(false))
          }}
        >
          {refreshing ? '更新中…' : '今すぐ更新'}
        </GhostBtn>
        <Field label="手動レート(¥1 = ₩?)※両替所の実レートを使う場合">
          <div className="flex items-center gap-2">
            <DecInput value={manualRate} onChange={setManualRate} placeholder="例: 9.15" />
            <button
              className="h-12 shrink-0 rounded-lg bg-gold-500 px-4 text-sm font-bold text-felt-950 disabled:opacity-40"
              disabled={manualRate == null || manualRate <= 0}
              onClick={() =>
                void updateSettings({ manualRate, manualRateTs: Date.now(), manualRateFixed: true })
              }
            >
              固定する
            </button>
          </div>
        </Field>
        {settings.manualRateFixed && (
          <GhostBtn onClick={() => void updateSettings({ manualRateFixed: false })}>
            手動固定を解除(自動更新に戻す)
          </GhostBtn>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gold-300">データ</h2>
        <div className="grid grid-cols-2 gap-2">
          <GhostBtn onClick={() => void exportCsv()}>CSVエクスポート</GhostBtn>
          <GhostBtn onClick={() => void exportJson()}>JSONエクスポート</GhostBtn>
        </div>
        <p className="text-[10px] text-ink-3">
          エクスポートには₩・¥両建て金額、適用レートとその取得時点が含まれます。データはすべて端末内(IndexedDB)にのみ保存されます。
        </p>
      </section>

      {settings.savedTables.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-gold-300">保存済みテーブル設定</h2>
          {settings.savedTables.map((t) => (
            <div key={t.name} className="flex items-center justify-between rounded-lg border border-felt-700 bg-felt-900 px-3 py-2">
              <div>
                <div className="text-xs font-bold">{t.name}</div>
                <div className="num text-[10px] text-ink-3">
                  min {t.tableMin.toLocaleString()} / max {t.tableMax.toLocaleString()} / タイ{t.tiePayout}:1 /
                  サイド{t.sideBets.filter((d) => d.enabled).length}種
                </div>
              </div>
              <button
                className="flex h-12 w-12 items-center justify-center text-ink-3"
                aria-label={`${t.name}を削除`}
                onClick={() =>
                  void updateSettings({ savedTables: settings.savedTables.filter((x) => x.name !== t.name) })
                }
              >
                🗑
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-lg bg-felt-900 p-3 text-[10px] leading-relaxed text-ink-3">
        <p>
          EZバカラ記録・資金管理(個人利用)。本アプリは記録・資金管理・理論値の可視化のみを目的とし、
          結果の予測や勝利を保証する機能は一切ありません。バカラの各ハンドは独立試行であり、控除率は固定です。
        </p>
      </section>
    </div>
  )
}
