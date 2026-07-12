import { useMemo, useState } from 'react'
import { bankrollOf, useApp } from '../store'
import type { BetPlacement, HandInput, SideBetDef, Winner } from '../types'
import { cardsNeed, totalNeed } from '../lib/settle'
import { recommendedBet } from '../lib/bankroll'
import { fmtBoth, fmtKrw, fmtSigned } from '../lib/money'
import { Confirm, GhostBtn } from './ui'
import HandEditModal from './HandEditModal'

const CHIPS = [10_000, 50_000, 100_000, 500_000]

export default function PlayScreen() {
  const { session, hands, rate, settings, addHand, undoLast, endSession } = useApp()
  const [chip, setChip] = useState(10_000)
  const [bets, setBets] = useState<Record<string, number>>({})
  const [entryWinner, setEntryWinner] = useState<Winner | null>(null)
  const [pendingInput, setPendingInput] = useState<HandInput | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [customChip, setCustomChip] = useState(false)

  if (!session) return null
  const bankroll = bankrollOf(session, hands)
  const curRate = rate?.rate ?? session.rate
  const enabledSides = session.sideBets.filter((d) => d.enabled)
  const betList: BetPlacement[] = Object.entries(bets)
    .filter(([, v]) => v > 0)
    .map(([target, amount]) => ({ target, amount }))
  const betTotal = betList.reduce((s, b) => s + b.amount, 0)
  const rec = recommendedBet(bankroll, settings.betPct, settings.chipUnit, session.tableMin)

  const addChip = (target: string) => setBets((b) => ({ ...b, [target]: (b[target] ?? 0) + chip }))
  const clearSpot = (target: string) => setBets((b) => ({ ...b, [target]: 0 }))

  /** 結果ボタン → 補助入力の要否を判定し、不要なら即登録 */
  const onResult = (winner: Winner) => {
    if (totalNeed(winner, enabledSides, betList) === 'none') {
      requestCommit({ winner, winnerTotal: null, winnerCards: null })
    } else {
      setEntryWinner(winner)
    }
  }

  /** 誤操作防止:現在資金の10%超のベットは確認ダイアログ */
  const requestCommit = (input: HandInput) => {
    if (betTotal > bankroll * 0.1 && betTotal > 0) {
      setPendingInput(input)
    } else {
      void addHand(input, betList)
    }
  }

  const last = hands[hands.length - 1]

  return (
    <div className="space-y-3 p-3 pb-6">
      {/* 推奨ベット額 */}
      <div className="rounded-xl border border-felt-700 bg-felt-900 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-ink-3">推奨ベット額({settings.betPct}%)</span>
          <span className="num text-base font-bold text-gold-300">{fmtBoth(rec.amount, curRate)}</span>
        </div>
        {rec.leaveTable && (
          <p className="mt-1 rounded bg-[#3d0b0b] px-2 py-1 text-xs font-bold text-banker">
            推奨額がテーブル最小額を下回りました:テーブル離脱を推奨します
          </p>
        )}
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
          期待値がマイナスのゲームでは賭け金の最適化は成立しません。推奨額は資金保全と時間管理のための基準です。
          サイドベットの控除率は本線より大幅に高くなります(理論値ボタンで確認)。
        </p>
      </div>

      {/* チップ選択 */}
      <div className="flex gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c}
            className={`num h-12 flex-1 rounded-lg border text-xs font-bold ${
              chip === c && !customChip
                ? 'border-gold-500 bg-gold-500 text-felt-950'
                : 'border-felt-700 bg-felt-900 text-ink-2'
            }`}
            onClick={() => {
              setChip(c)
              setCustomChip(false)
            }}
          >
            {c >= 10_000 ? `${c / 10_000}万` : fmtKrw(c)}
          </button>
        ))}
        <button
          className={`h-12 flex-1 rounded-lg border text-xs font-bold ${
            customChip ? 'border-gold-500 bg-gold-500 text-felt-950' : 'border-felt-700 bg-felt-900 text-ink-2'
          }`}
          onClick={() => {
            const v = prompt('チップ額(KRW)を入力')
            const n = v ? Number(v.replace(/[^\d]/g, '')) : NaN
            if (!Number.isNaN(n) && n > 0) {
              setChip(n)
              setCustomChip(true)
            }
          }}
        >
          {customChip ? `₩${chip.toLocaleString()}` : '直接入力'}
        </button>
      </div>

      {/* ベットスポット */}
      <div className="grid grid-cols-3 gap-1.5">
        <BetSpot label="バンカー" color="banker" amount={bets['B'] ?? 0} onAdd={() => addChip('B')} onClear={() => clearSpot('B')} />
        <BetSpot label="プレイヤー" color="player" amount={bets['P'] ?? 0} onAdd={() => addChip('P')} onClear={() => clearSpot('P')} />
        <BetSpot label={`タイ ${session.tiePayout}:1`} color="tie" amount={bets['T'] ?? 0} onAdd={() => addChip('T')} onClear={() => clearSpot('T')} />
      </div>
      {enabledSides.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {enabledSides.map((d) => (
            <BetSpot
              key={d.id}
              label={d.name}
              color="gold"
              small
              amount={bets[d.id] ?? 0}
              onAdd={() => addChip(d.id)}
              onClear={() => clearSpot(d.id)}
            />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-3">
          合計ベット:<span className="num font-bold text-ink">{fmtKrw(betTotal)}</span>
          {betTotal === 0 && <span className="ml-1">(見:結果のみ記録)</span>}
          {betTotal > bankroll && <span className="ml-1 font-bold text-banker">資金超過!</span>}
        </span>
        {betTotal > 0 && (
          <button className="h-10 px-3 font-bold text-ink-3 underline" onClick={() => setBets({})}>
            全クリア
          </button>
        )}
      </div>

      {/* 結果ボタン(1ハンド3タップ以内の起点) */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          className="h-20 rounded-xl bg-banker text-lg font-bold text-felt-950 active:opacity-80"
          onClick={() => onResult('B')}
        >
          BANKER
        </button>
        <button
          className="h-20 rounded-xl bg-player text-lg font-bold text-felt-950 active:opacity-80"
          onClick={() => onResult('P')}
        >
          PLAYER
        </button>
        <button
          className="h-20 rounded-xl bg-tie text-lg font-bold text-felt-950 active:opacity-80"
          onClick={() => onResult('T')}
        >
          TIE
        </button>
      </div>

      {/* 履歴 */}
      <div className="rounded-xl border border-felt-700 bg-felt-900">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-bold text-ink-2">履歴({hands.length}ハンド)</span>
          {last && (
            <button className="h-10 rounded-lg border border-felt-700 px-3 text-xs font-bold text-gold-300" onClick={() => void undoLast()}>
              ↩ 直前を取消
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {hands.length === 0 && <p className="px-3 pb-3 text-xs text-ink-3">まだ記録がありません</p>}
          {[...hands].reverse().map((h) => (
            <button
              key={h.id}
              className="flex w-full items-center gap-2 border-t border-felt-800 px-3 py-2 text-left active:bg-felt-800"
              onClick={() => setEditingId(h.id!)}
            >
              <span className="num w-8 text-xs text-ink-3">#{h.seq}</span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-felt-950 ${
                  h.winner === 'B' ? 'bg-banker' : h.winner === 'P' ? 'bg-player' : 'bg-tie'
                }`}
              >
                {h.winner}
              </span>
              <span className="flex-1 text-xs text-ink-2">
                {h.winnerTotal != null && <span className="num">計{h.winnerTotal}</span>}
                {h.winnerCards != null && <span className="num ml-1">{h.winnerCards}枚</span>}
                {h.winner === 'B' && h.winnerTotal === 7 && h.winnerCards === 3 && (
                  <span className="ml-1 font-bold text-gold-300">D7</span>
                )}
                <span className="ml-1 text-ink-3">{h.bets.length === 0 ? '見' : `${h.bets.length}件`}</span>
              </span>
              <span className={`num text-sm font-bold ${h.net > 0 ? 'text-tie' : h.net < 0 ? 'text-banker' : 'text-ink-3'}`}>
                {h.bets.length === 0 ? '—' : fmtSigned(h.net)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <GhostBtn onClick={() => setConfirmEnd(true)}>セッションを終了する</GhostBtn>

      {/* 補助入力シート */}
      {entryWinner && (
        <ResultSheet
          winner={entryWinner}
          sideBets={enabledSides}
          bets={betList}
          onCancel={() => setEntryWinner(null)}
          onCommit={(input) => {
            setEntryWinner(null)
            requestCommit(input)
          }}
        />
      )}

      {/* 10%超確認 */}
      {pendingInput && (
        <Confirm
          message="高額ベットの確認"
          detail={`合計 ${fmtKrw(betTotal)} は現在資金の10%を超えています。登録しますか?`}
          okLabel="登録する"
          onOk={() => {
            void addHand(pendingInput, betList)
            setPendingInput(null)
          }}
          onCancel={() => setPendingInput(null)}
        />
      )}

      {confirmEnd && (
        <Confirm
          message="セッションを終了しますか?"
          detail={`現在資金 ${fmtBoth(bankroll, curRate)} / ${hands.length}ハンド`}
          okLabel="終了する"
          onOk={() => {
            setConfirmEnd(false)
            void endSession()
          }}
          onCancel={() => setConfirmEnd(false)}
        />
      )}

      {editingId != null && <HandEditModal handId={editingId} onClose={() => setEditingId(null)} />}
    </div>
  )
}

function BetSpot({
  label,
  color,
  amount,
  small,
  onAdd,
  onClear,
}: {
  label: string
  color: 'banker' | 'player' | 'tie' | 'gold'
  amount: number
  small?: boolean
  onAdd: () => void
  onClear: () => void
}) {
  const border =
    color === 'banker'
      ? 'border-banker'
      : color === 'player'
        ? 'border-player'
        : color === 'tie'
          ? 'border-tie'
          : 'border-gold-600'
  return (
    <div className={`relative rounded-xl border-2 ${border} ${amount > 0 ? 'bg-felt-800' : 'bg-felt-900'}`}>
      <button className={`w-full px-1 ${small ? 'h-14' : 'h-16'}`} onClick={onAdd}>
        <div className={`font-bold ${small ? 'text-[11px]' : 'text-sm'}`}>{label}</div>
        <div className={`num font-bold ${amount > 0 ? 'text-gold-300' : 'text-ink-3'} ${small ? 'text-xs' : 'text-sm'}`}>
          {amount > 0 ? fmtKrw(amount) : 'タップで賭け'}
        </div>
      </button>
      {amount > 0 && (
        <button
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-felt-700 text-xs text-ink"
          onClick={onClear}
          aria-label={`${label}をクリア`}
        >
          ✕
        </button>
      )}
    </div>
  )
}

/**
 * 勝利合計値・枚数の補助入力シート。
 * 表示要否・必須/省略可は有効サイドベット構成と現在のベットから判定(settle.ts の totalNeed / cardsNeed)。
 * 合計値→(必要なら)枚数の順にタップすると自動で登録される。
 */
function ResultSheet({
  winner,
  sideBets,
  bets,
  onCancel,
  onCommit,
}: {
  winner: Winner
  sideBets: SideBetDef[]
  bets: BetPlacement[]
  onCancel: () => void
  onCommit: (input: HandInput) => void
}) {
  const [total, setTotal] = useState<number | null>(null)

  const tn = useMemo(() => totalNeed(winner, sideBets, bets), [winner, sideBets, bets])
  const cn = cardsNeed(winner, total, sideBets, bets)

  const name = winner === 'B' ? 'バンカー' : winner === 'P' ? 'プレイヤー' : 'タイ'
  const color = winner === 'B' ? 'text-banker' : winner === 'P' ? 'text-player' : 'text-tie'
  const totals = winner === 'T' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const isD7Choice = winner === 'B' && total === 7

  const pickTotal = (n: number) => {
    setTotal(n)
    if (cardsNeed(winner, n, sideBets, bets) === 'none') {
      onCommit({ winner, winnerTotal: n, winnerCards: null })
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onCancel}>
      <div
        className="w-full rounded-t-2xl border-t border-felt-700 bg-felt-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-lg font-bold ${color}`}>{name}勝ち</span>
            <div className="flex items-center gap-1">
              {tn === 'optional' && total == null && (
                <button
                  className="h-12 rounded-lg border border-felt-700 px-3 text-sm text-ink-2"
                  onClick={() => onCommit({ winner, winnerTotal: null, winnerCards: null })}
                >
                  合計値を省略
                </button>
              )}
              <button className="h-12 px-3 text-sm text-ink-3" onClick={onCancel}>
                キャンセル
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-bold text-ink-2">
              勝利合計値{tn === 'required' ? '(必須)' : ''}
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {totals.map((n) => (
                <button
                  key={n}
                  className={`num h-14 rounded-lg border text-lg font-bold ${
                    total === n ? 'border-gold-500 bg-gold-500 text-felt-950' : 'border-felt-700 bg-felt-950'
                  }`}
                  onClick={() => pickTotal(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {total != null && cn !== 'none' && (
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-2">
                {isD7Choice
                  ? 'バンカーの枚数(3枚 = ドラゴン7:バンカーベットはプッシュ)'
                  : `勝利ハンドの枚数${cn === 'required' ? '(必須)' : ''}`}
              </span>
              <div className={`grid gap-1.5 ${cn === 'optional' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  className="h-14 rounded-lg border border-felt-700 bg-felt-950 text-base font-bold"
                  onClick={() => onCommit({ winner, winnerTotal: total, winnerCards: 2 })}
                >
                  2枚
                </button>
                <button
                  className={`h-14 rounded-lg border bg-felt-950 text-base font-bold ${
                    isD7Choice ? 'border-gold-500 text-gold-300' : 'border-felt-700'
                  }`}
                  onClick={() => onCommit({ winner, winnerTotal: total, winnerCards: 3 })}
                >
                  {isD7Choice ? '3枚(D7)' : '3枚'}
                </button>
                {cn === 'optional' && (
                  <button
                    className="h-14 rounded-lg border border-felt-700 bg-felt-950 text-sm text-ink-2"
                    onClick={() => onCommit({ winner, winnerTotal: total, winnerCards: null })}
                  >
                    省略
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
