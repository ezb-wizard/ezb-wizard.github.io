import { useMemo, useState } from 'react'
import { useApp } from '../store'
import type { BetPlacement, Winner } from '../types'
import { cardsNeed, totalNeed } from '../lib/settle'
import { Confirm, Field, Modal, NumInput, PrimaryBtn, Seg } from './ui'

/** 履歴ハンドの編集・削除 */
export default function HandEditModal({ handId, onClose }: { handId: number; onClose: () => void }) {
  const { session, hands, updateHand, deleteHand } = useApp()
  const hand = hands.find((h) => h.id === handId)

  const [winner, setWinner] = useState<Winner>(hand?.winner ?? 'B')
  const [total, setTotal] = useState<number | null>(hand?.winnerTotal ?? null)
  const [cards, setCards] = useState<2 | 3 | null>(hand?.winnerCards ?? null)
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries((hand?.bets ?? []).map((b) => [b.target, b.amount])),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const enabledSides = useMemo(() => session?.sideBets.filter((d) => d.enabled) ?? [], [session])
  if (!session || !hand) return null

  const betList: BetPlacement[] = Object.entries(amounts)
    .filter(([, v]) => v > 0)
    .map(([target, amount]) => ({ target, amount }))

  const tn = totalNeed(winner, enabledSides, betList)
  const cn = cardsNeed(winner, total, enabledSides, betList)
  const errors: string[] = []
  if (tn === 'required' && total == null) errors.push('この勝者・ベット構成では勝利合計値が必須です')
  if (cn === 'required' && cards == null) errors.push('この合計値では枚数の入力が必須です')

  const targets: { id: string; name: string }[] = [
    { id: 'B', name: 'バンカー' },
    { id: 'P', name: 'プレイヤー' },
    { id: 'T', name: `タイ ${session.tiePayout}:1` },
    ...enabledSides.map((d) => ({ id: d.id, name: d.name })),
  ]

  const save = () => {
    if (errors.length > 0) return
    void updateHand(handId, { winner, winnerTotal: total, winnerCards: cards }, betList)
    onClose()
  }

  return (
    <Modal
      title={`ハンド #${hand.seq} を編集`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button
            className="h-12 rounded-lg border border-banker px-4 text-sm font-bold text-banker"
            onClick={() => setConfirmDelete(true)}
          >
            削除
          </button>
          <PrimaryBtn className="h-12 flex-1" onClick={save} disabled={errors.length > 0}>
            保存
          </PrimaryBtn>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="勝者">
          <Seg
            options={[
              { value: 'B', label: 'バンカー' },
              { value: 'P', label: 'プレイヤー' },
              { value: 'T', label: 'タイ' },
            ]}
            value={winner}
            onChange={(w) => {
              setWinner(w)
              setTotal(null)
              setCards(null)
            }}
          />
        </Field>

        <Field label="勝利合計値">
          <div className="grid grid-cols-6 gap-1.5">
            <button
              className={`h-12 rounded-lg border text-xs font-bold ${
                total == null ? 'border-gold-500 bg-gold-500 text-felt-950' : 'border-felt-700 bg-felt-950 text-ink-2'
              }`}
              onClick={() => {
                setTotal(null)
                setCards(null)
              }}
            >
              なし
            </button>
            {(winner === 'T' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9]).map((n) => (
              <button
                key={n}
                className={`num h-12 rounded-lg border text-base font-bold ${
                  total === n ? 'border-gold-500 bg-gold-500 text-felt-950' : 'border-felt-700 bg-felt-950'
                }`}
                onClick={() => setTotal(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        {winner !== 'T' && total != null && (
          <Field label="勝利ハンドの枚数">
            <Seg
              options={[
                { value: 0, label: '不明' },
                { value: 2, label: '2枚' },
                { value: 3, label: '3枚' },
              ]}
              value={cards ?? 0}
              onChange={(v) => setCards(v === 0 ? null : (v as 2 | 3))}
            />
          </Field>
        )}

        <Field label="ベット(0 = ベットなし)">
          <div className="space-y-2">
            {targets.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-28 text-xs text-ink-2">{t.name}</span>
                <NumInput
                  value={amounts[t.id] ?? null}
                  onChange={(v) => setAmounts((a) => ({ ...a, [t.id]: v ?? 0 }))}
                  className="!h-10"
                />
              </div>
            ))}
          </div>
        </Field>

        {errors.map((e) => (
          <p key={e} className="text-xs font-bold text-banker">
            {e}
          </p>
        ))}
      </div>

      {confirmDelete && (
        <Confirm
          message="このハンドを削除しますか?"
          okLabel="削除する"
          onOk={() => {
            void deleteHand(handId)
            onClose()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  )
}
