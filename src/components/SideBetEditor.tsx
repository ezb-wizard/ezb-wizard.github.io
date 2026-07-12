import { useMemo, useState } from 'react'
import type { CardCondition, SideBetDef, Winner } from '../types'
import { sideBetStats } from '../lib/sidebets'
import { fmtPct } from '../lib/money'
import { Field, NumInput, Seg } from './ui'

const SIDE_LABEL: Record<Winner, string> = { B: 'バンカー', P: 'プレイヤー', T: 'タイ' }
const CARD_LABEL: Record<CardCondition, string> = { any: '枚数任意', '2': '2枚のみ', '3': '3枚のみ' }

/** ルールの成立条件を人間可読に */
function ruleLabel(def: SideBetDef, r: SideBetDef['rules'][number]): string {
  if (def.pairTarget) {
    return def.pairTarget === 'P'
      ? 'プレイヤー最初の2枚が同ランク'
      : def.pairTarget === 'B'
        ? 'バンカー最初の2枚が同ランク'
        : 'どちらかの最初の2枚が同ランク'
  }
  const parts = [r.totals.length ? `合計${r.totals.join('・')}` : '合計任意', CARD_LABEL[r.cards]]
  if (r.loserTotals?.length) parts.push(`負け側${r.loserTotals.join('・')}`)
  if (r.totalCards?.length) parts.push(`両者計${r.totalCards.join('・')}枚`)
  return parts.join(' / ')
}

/** サイドベット構成エディタ(有効/無効・配当変更・カスタム定義追加) */
export default function SideBetEditor({
  defs,
  onChange,
}: {
  defs: SideBetDef[]
  onChange: (defs: SideBetDef[]) => void
}) {
  const [adding, setAdding] = useState(false)

  const update = (id: string, patch: Partial<SideBetDef>) =>
    onChange(defs.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  return (
    <div className="space-y-2">
      {defs.map((d) => (
        <SideBetRow
          key={d.id}
          def={d}
          onToggle={() => update(d.id, { enabled: !d.enabled })}
          onPayout={(ruleIdx, payout) =>
            update(d.id, {
              rules: d.rules.map((r, i) => (i === ruleIdx ? { ...r, payout } : r)),
            })
          }
          onDelete={d.preset ? undefined : () => onChange(defs.filter((x) => x.id !== d.id))}
        />
      ))}
      {adding ? (
        <CustomForm
          onAdd={(def) => {
            onChange([...defs, def])
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          className="h-12 w-full rounded-lg border border-dashed border-base-700 text-sm font-bold text-ink-2"
          onClick={() => setAdding(true)}
        >
          + カスタムサイドベットを追加
        </button>
      )}
    </div>
  )
}

function SideBetRow({
  def,
  onToggle,
  onPayout,
  onDelete,
}: {
  def: SideBetDef
  onToggle: () => void
  onPayout: (ruleIdx: number, payout: number) => void
  onDelete?: () => void
}) {
  // 内蔵確率 × 設定配当から控除率を動的算出
  const stats = useMemo(
    () => (def.enabled ? sideBetStats(def) : null),
    [def.enabled, def.rules.map((r) => r.payout).join(','), def.id], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return (
    <div className={`rounded-lg border p-3 ${def.enabled ? 'border-gold-600 bg-base-900' : 'border-base-800 bg-base-950 opacity-70'}`}>
      <div className="flex items-center justify-between">
        <button className="flex min-h-12 flex-1 items-center gap-2 text-left" onClick={onToggle}>
          <span
            className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${def.enabled ? 'bg-gold-500' : 'bg-base-700'}`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-ink transition-transform ${def.enabled ? 'translate-x-5' : ''}`}
            />
          </span>
          <span className="text-sm font-bold">{def.name}</span>
          {def.pairTarget ? (
            <span className="rounded bg-gold-600 px-1.5 py-0.5 text-[10px] font-bold text-base-950">
              {def.pairTarget === 'either' ? 'P/Bペア' : `${def.pairTarget}ペア`}
            </span>
          ) : (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${
                def.side === 'B' ? 'bg-banker' : def.side === 'P' ? 'bg-player' : 'bg-tie'
              }`}
            >
              {SIDE_LABEL[def.side]}
            </span>
          )}
        </button>
        {onDelete && (
          <button className="flex h-12 w-10 items-center justify-center text-ink-3" onClick={onDelete} aria-label="削除">
            🗑
          </button>
        )}
      </div>
      <div className="mt-1 space-y-1">
        {def.rules.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-ink-2">
            <span className="flex-1">{ruleLabel(def, r)}</span>
            <NumInput
              value={r.payout}
              onChange={(v) => onPayout(i, v ?? 0)}
              className="!h-10 !w-20"
              disabled={!def.enabled}
            />
            <span>:1</span>
          </div>
        ))}
      </div>
      {stats && (
        <div className="num mt-1 text-right text-[11px]">
          <span className="text-ink-3">成立率 {fmtPct(stats.winProb)} / </span>
          <span className={stats.edge > 0.1 ? 'font-bold text-lose' : 'text-ink-2'}>
            控除率 {fmtPct(stats.edge)}
          </span>
        </div>
      )}
    </div>
  )
}

function CustomForm({ onAdd, onCancel }: { onAdd: (d: SideBetDef) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [side, setSide] = useState<Winner>('B')
  const [totals, setTotals] = useState<number[]>([])
  const [cards, setCards] = useState<CardCondition>('any')
  const [payout, setPayout] = useState<number | null>(null)

  const valid = name.trim() !== '' && payout != null && payout > 0

  return (
    <div className="space-y-3 rounded-lg border border-gold-600 bg-base-900 p-3">
      <Field label="名称">
        <input
          type="text"
          className="h-12 w-full rounded-lg border border-base-700 bg-base-950 px-3 text-ink focus:border-gold-500 focus:outline-none"
          value={name}
          placeholder="例: ビッグタイガー"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="対象サイド">
        <Seg
          options={[
            { value: 'B', label: 'バンカー' },
            { value: 'P', label: 'プレイヤー' },
            { value: 'T', label: 'タイ' },
          ]}
          value={side}
          onChange={(v) => {
            setSide(v)
            if (v === 'T') setCards('any')
          }}
        />
      </Field>
      <Field label="勝利合計値(未選択 = 任意)">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, n) => (
            <button
              key={n}
              className={`h-12 w-[calc(20%-6px)] rounded-lg border text-sm font-bold ${
                totals.includes(n)
                  ? 'border-gold-500 bg-gold-500 text-base-950'
                  : 'border-base-700 bg-base-950 text-ink-2'
              }`}
              onClick={() =>
                setTotals((ts) => (ts.includes(n) ? ts.filter((x) => x !== n) : [...ts, n].sort((a, b) => a - b)))
              }
            >
              {n}
            </button>
          ))}
        </div>
      </Field>
      {side !== 'T' && (
        <Field label="枚数条件">
          <Seg
            options={[
              { value: 'any', label: '任意' },
              { value: '2', label: '2枚のみ' },
              { value: '3', label: '3枚のみ' },
            ]}
            value={cards}
            onChange={setCards}
          />
        </Field>
      )}
      <Field label="配当倍率(n:1)">
        <NumInput value={payout} onChange={setPayout} placeholder="例: 50" />
      </Field>
      <div className="flex gap-2">
        <button className="h-12 flex-1 rounded-lg border border-base-700 text-sm font-bold text-ink-2" onClick={onCancel}>
          キャンセル
        </button>
        <button
          className="h-12 flex-1 rounded-lg bg-gold-500 text-sm font-bold text-base-950 disabled:opacity-40"
          disabled={!valid}
          onClick={() =>
            onAdd({
              id: `custom_${Date.now()}`,
              name: name.trim(),
              side,
              rules: [{ totals, cards: side === 'T' ? 'any' : cards, payout: payout! }],
              enabled: true,
            })
          }
        >
          追加
        </button>
      </div>
    </div>
  )
}
