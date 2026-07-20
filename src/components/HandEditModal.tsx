import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { sessionRules, type BetPlacement, type Winner } from '../types'
import { cardsNeed, loserNeed, pairNeed, totalNeed } from '../lib/settle'
import { Confirm, Field, Modal, NumInput, PrimaryBtn, Seg } from './ui'

type TriState = 0 | 1 | 2 // 0=不明 1=なし 2=あり

const toTri = (v: boolean | null | undefined): TriState => (v == null ? 0 : v ? 2 : 1)
const fromTri = (t: TriState): boolean | null => (t === 0 ? null : t === 2)

/** 履歴ハンドの編集・削除 */
export default function HandEditModal({ handId, onClose }: { handId: number; onClose: () => void }) {
  const { session, hands, updateHand, deleteHand } = useApp()
  const hand = hands.find((h) => h.id === handId)

  const [winner, setWinner] = useState<Winner>(hand?.winner ?? 'B')
  const [total, setTotal] = useState<number | null>(hand?.winnerTotal ?? null)
  const [cards, setCards] = useState<2 | 3 | null>(hand?.winnerCards ?? null)
  const [loserTotal, setLoserTotal] = useState<number | null>(hand?.loserTotal ?? null)
  const [loserCards, setLoserCards] = useState<2 | 3 | null>(hand?.loserCards ?? null)
  const [pPair, setPPair] = useState<TriState>(toTri(hand?.pPair))
  const [bPair, setBPair] = useState<TriState>(toTri(hand?.bPair))
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries((hand?.bets ?? []).map((b) => [b.target, b.amount])),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const enabledSides = useMemo(() => session?.sideBets.filter((d) => d.enabled) ?? [], [session])
  if (!session || !hand) return null
  const rules = sessionRules(session)

  const betList: BetPlacement[] = Object.entries(amounts)
    .filter(([, v]) => v > 0)
    .map(([target, amount]) => ({ target, amount }))

  const tn = totalNeed(winner, enabledSides, betList, rules)
  const cn = cardsNeed(winner, total, enabledSides, betList, rules)
  const ln = loserNeed(winner, total, loserTotal, enabledSides, betList)
  const pn = pairNeed(enabledSides, betList)
  // ベット中ペアの側だけ必須(精算に不要な側は強制しない)
  const pairBetOn = (side: 'P' | 'B') =>
    enabledSides.some(
      (d) =>
        (d.pairTarget === side || d.pairTarget === 'either') &&
        betList.some((b) => b.target === d.id && b.amount > 0),
    )

  const errors: string[] = []
  if (tn === 'required' && total == null) errors.push('この勝者・ベット構成では勝ち側の合計値が必須です')
  if (cn === 'required' && cards == null) errors.push('このベット構成では勝ち側の枚数が必須です')
  if (ln.total === 'required' && loserTotal == null) errors.push('ドラゴンタイガー判定には負け側の合計値が必須です')
  if (ln.cards === 'required' && loserTotal != null && loserCards == null)
    errors.push('負け側の枚数(合計枚数配当)が必須です')
  if (pn === 'required') {
    if (pairBetOn('P') && pPair === 0) errors.push('Pペアベット中はPペア有無の入力が必須です')
    if (pairBetOn('B') && bPair === 0) errors.push('Bペアベット中はBペア有無の入力が必須です')
  }

  const targets: { id: string; name: string }[] = [
    { id: 'B', name: 'バンカー' },
    { id: 'P', name: 'プレイヤー' },
    ...(rules.tieEnabled !== false ? [{ id: 'T', name: `タイ ${rules.tiePayout}:1` }] : []),
    ...enabledSides.map((d) => ({ id: d.id, name: d.name })),
  ]

  const save = () => {
    if (errors.length > 0) return
    void updateHand(
      handId,
      {
        winner,
        winnerTotal: total,
        winnerCards: cards,
        loserTotal,
        loserCards,
        pPair: fromTri(pPair),
        bPair: fromTri(bPair),
      },
      betList,
    )
    onClose()
  }

  return (
    <Modal
      title={`ハンド #${hand.seq} を編集`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button
            className="press h-12 rounded-lg border border-lose px-4 text-sm font-bold text-lose"
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
              setLoserTotal(null)
              setLoserCards(null)
            }}
          />
        </Field>

        <Field label="勝ち側の合計値">
          <div className="grid grid-cols-6 gap-1.5">
            <button
              className={`h-12 rounded-lg border text-xs font-bold ${
                total == null ? 'btn-gold border-transparent' : 'border-base-700 bg-base-950 text-ink-2'
              }`}
              onClick={() => {
                setTotal(null)
                setCards(null)
                setLoserTotal(null)
                setLoserCards(null)
              }}
            >
              なし
            </button>
            {(winner === 'T' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9]).map((n) => (
              <button
                key={n}
                className={`num h-12 rounded-lg border text-base font-bold ${
                  total === n ? 'btn-gold border-transparent' : 'border-base-700 bg-base-950'
                }`}
                onClick={() => {
                  // 合計値の変更で従属入力(枚数・負け側)は無効になるためリセットする
                  setTotal(n)
                  setCards(null)
                  setLoserTotal(null)
                  setLoserCards(null)
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        {winner !== 'T' && (
          <Field label="勝ち側の枚数">
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

        {winner !== 'T' && ln.total !== 'none' && (
          <>
            <Field label={`負け側(${winner === 'P' ? 'バンカー' : 'プレイヤー'})の合計値`}>
              <div className="grid grid-cols-6 gap-1.5">
                <button
                  className={`h-12 rounded-lg border text-xs font-bold ${
                    loserTotal == null ? 'btn-gold border-transparent' : 'border-base-700 bg-base-950 text-ink-2'
                  }`}
                  onClick={() => {
                    setLoserTotal(null)
                    setLoserCards(null)
                  }}
                >
                  なし
                </button>
                {Array.from({ length: total ?? 10 }, (_, n) => (
                  <button
                    key={n}
                    className={`num h-12 rounded-lg border text-base font-bold ${
                      loserTotal === n ? 'btn-gold border-transparent' : 'border-base-700 bg-base-950'
                    }`}
                    onClick={() => setLoserTotal(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            {loserTotal != null && ln.cards !== 'none' && (
              <Field label="負け側の枚数">
                <Seg
                  options={[
                    { value: 0, label: '不明' },
                    { value: 2, label: '2枚' },
                    { value: 3, label: '3枚' },
                  ]}
                  value={loserCards ?? 0}
                  onChange={(v) => setLoserCards(v === 0 ? null : (v as 2 | 3))}
                />
              </Field>
            )}
          </>
        )}

        {pn !== 'none' && (
          <>
            <Field label="プレイヤーペア">
              <Seg
                options={[
                  { value: 0, label: '不明' },
                  { value: 1, label: 'なし' },
                  { value: 2, label: 'あり' },
                ]}
                value={pPair}
                onChange={setPPair}
              />
            </Field>
            <Field label="バンカーペア">
              <Seg
                options={[
                  { value: 0, label: '不明' },
                  { value: 1, label: 'なし' },
                  { value: 2, label: 'あり' },
                ]}
                value={bPair}
                onChange={setBPair}
              />
            </Field>
          </>
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
          <p key={e} className="text-xs font-bold text-lose">
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
