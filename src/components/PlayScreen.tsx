import { useState } from 'react'
import { bankrollOf, useApp } from '../store'
import { sessionRules, type BetPlacement, type HandInput, type MainBetRules, type SideBetDef, type Winner } from '../types'
import { cardsNeed, loserNeed, pairNeed, settleHand, totalNeed } from '../lib/settle'
import { recommendedBet } from '../lib/bankroll'
import { fmtBoth, fmtKrw, fmtSigned } from '../lib/money'
import { Confirm, GhostBtn } from './ui'
import HandEditModal from './HandEditModal'
import RoadsModal from './RoadsModal'

const DEFAULT_CHIPS = [100_000, 500_000, 1_000_000, 5_000_000]

export default function PlayScreen() {
  const { session, hands, rate, settings, addHand, undoLast, endSession } = useApp()
  const chips = settings.chipPresets?.length === 4 ? settings.chipPresets : DEFAULT_CHIPS
  const [chip, setChip] = useState(() => chips[0])
  const [roadsOpen, setRoadsOpen] = useState(false)
  const [bets, setBets] = useState<Record<string, number>>({})
  const [entryWinner, setEntryWinner] = useState<Winner | null>(null)
  const [pendingInput, setPendingInput] = useState<HandInput | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [customChip, setCustomChip] = useState(false)
  const [flash, setFlash] = useState<{ kind: 'win' | 'lose' | 'push'; key: number } | null>(null)

  if (!session) return null
  const bankroll = bankrollOf(session, hands)
  const curRate = rate?.rate ?? session.rate
  const rules = sessionRules(session)
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
    const needsSheet =
      totalNeed(winner, enabledSides, betList, rules) !== 'none' ||
      cardsNeed(winner, null, enabledSides, betList, rules) !== 'none' ||
      loserNeed(winner, null, null, enabledSides, betList).total !== 'none' ||
      pairNeed(enabledSides, betList) !== 'none'
    if (!needsSheet) {
      requestCommit({ winner, winnerTotal: null, winnerCards: null, loserTotal: null, loserCards: null, pPair: null, bPair: null })
    } else {
      setEntryWinner(winner)
    }
  }

  /** 誤操作防止:現在資金の10%超のベットは確認ダイアログ */
  const requestCommit = (input: HandInput) => {
    if (betTotal > bankroll * 0.1 && betTotal > 0) {
      setPendingInput(input)
    } else {
      commit(input)
    }
  }

  const commit = (input: HandInput) => {
    // 勝敗登録時の色フラッシュ(250ms・ベットありの場合のみ)
    if (betList.length > 0) {
      const net = settleHand(betList, input, { mainBets: rules, sideBets: session.sideBets })
      setFlash({ kind: net > 0 ? 'win' : net < 0 ? 'lose' : 'push', key: (flash?.key ?? 0) + 1 })
    }
    void addHand(input, betList)
  }

  const last = hands[hands.length - 1]

  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      {/* 登録フラッシュ(全画面・操作は透過) */}
      {flash && <div key={flash.key} className={`pointer-events-none fixed inset-0 z-30 flash-${flash.kind}`} />}

      {/* 推奨ベット額 */}
      <div className="card-luxe p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-ink-3">推奨ベット額({settings.betPct}%)</span>
          <span className="num text-base font-bold text-gold-300">{fmtBoth(rec.amount, curRate)}</span>
        </div>
        {rec.leaveTable && (
          <p className="mt-1 rounded bg-[#31090c] px-2 py-1 text-xs font-bold text-lose">
            推奨額がテーブル最小額を下回りました:テーブル離脱を推奨します
          </p>
        )}
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
          期待値がマイナスのゲームでは賭け金の最適化は成立しません。推奨額は資金保全と時間管理のための基準です。
          サイドベットの控除率は本線より大幅に高くなります(理論値ボタンで確認)。
        </p>
      </div>

      {/* 履歴 */}
      <div className="card-luxe flex-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-bold text-ink-2">履歴({hands.length}ハンド)</span>
          <div className="flex gap-1.5">
            <button
              className="press h-10 rounded-lg border border-gold-600/40 px-3 text-xs font-bold text-gold-300"
              onClick={() => setRoadsOpen(true)}
            >
              罫線
            </button>
            {last && (
              <button
                className="press h-10 rounded-lg border border-gold-600/40 px-3 text-xs font-bold text-gold-300"
                onClick={() => void undoLast()}
              >
                ↩ 取消
              </button>
            )}
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {hands.length === 0 && <p className="px-3 pb-3 text-xs text-ink-3">まだ記録がありません</p>}
          {[...hands].reverse().map((h) => (
            <button
              key={h.id}
              className="flex w-full items-center gap-2 border-t border-base-800 px-3 py-2 text-left active:bg-base-800"
              onClick={() => setEditingId(h.id!)}
            >
              <span className="num w-8 text-xs text-ink-3">#{h.seq}</span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
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
              <span className={`num text-sm font-bold ${h.net > 0 ? 'text-win' : h.net < 0 ? 'text-lose' : 'text-ink-3'}`}>
                {h.bets.length === 0 ? '—' : fmtSigned(h.net)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <GhostBtn onClick={() => setConfirmEnd(true)}>セッションを終了する</GhostBtn>

      {/* 操作クラスタ(親指リーチ優先で画面下部に固定) */}
      <div className="sticky bottom-0 z-20 -mx-3 -mb-3 space-y-1.5 border-t border-gold-600/25 bg-base-950/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        {/* チップ選択 */}
        <div className="flex gap-1.5">
          {chips.map((c) => (
            <button
              key={c}
              className={`num press h-11 flex-1 rounded-lg border text-xs font-bold ${
                chip === c && !customChip ? 'btn-gold border-transparent' : 'border-base-700 bg-base-900 text-ink-2'
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
            className={`press h-11 flex-1 rounded-lg border text-xs font-bold ${
              customChip ? 'btn-gold border-transparent' : 'border-base-700 bg-base-900 text-ink-2'
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

        {/* ベットスポット(実テーブルと同じ配置) */}
        <BetSpots
          enabledSides={enabledSides}
          tieLabel={`タイ ${rules.tiePayout}:1`}
          tieEnabled={rules.tieEnabled !== false}
          bets={bets}
          onAdd={addChip}
          onClear={clearSpot}
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-3">
            合計ベット:<span className="num font-bold text-ink">{fmtKrw(betTotal)}</span>
            {betTotal === 0 && <span className="ml-1">(見:結果のみ記録)</span>}
            {betTotal > bankroll && <span className="ml-1 font-bold text-lose">資金超過!</span>}
          </span>
          {betTotal > 0 && (
            <button className="h-9 px-3 font-bold text-ink-3 underline" onClick={() => setBets({})}>
              全クリア
            </button>
          )}
        </div>

        {/* 結果ボタン(1ハンド3タップ以内の起点) */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            className="press h-20 rounded-xl bg-banker text-lg font-bold text-white shadow-lg shadow-banker/25"
            onClick={() => onResult('B')}
          >
            BANKER
          </button>
          <button
            className="press h-20 rounded-xl bg-player text-lg font-bold text-white shadow-lg shadow-player/25"
            onClick={() => onResult('P')}
          >
            PLAYER
          </button>
          <button
            className="press h-20 rounded-xl bg-tie text-lg font-bold text-white shadow-lg shadow-tie/25"
            onClick={() => onResult('T')}
          >
            TIE
          </button>
        </div>
      </div>

      {/* 補助入力シート */}
      {entryWinner && (
        <ResultSheet
          winner={entryWinner}
          sideBets={enabledSides}
          bets={betList}
          rules={rules}
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
            commit(pendingInput)
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
      {roadsOpen && <RoadsModal onClose={() => setRoadsOpen(false)} />}
    </div>
  )
}

/**
 * ベットスポット。実テーブル(Dragon Tiger Baccarat)と同じ配置:
 *   スモールドラゴン / ドラゴンタイガー / ビッグドラゴン
 *   スモールタイガー / タイ / ビッグタイガー
 *   バンカーペア / バンカー(2列分)
 *   プレイヤーペア / プレイヤー(2列分)
 * テンプレートに無い有効サイドベット(カスタム等)は最上段に3列で並べる。
 */
const TABLE_LAYOUT: string[][] = [
  ['SMALL_DRAGON', 'DRAGON_TIGER', 'BIG_DRAGON'],
  ['SMALL_TIGER', 'T', 'BIG_TIGER'],
  ['TIE_MAX_06', 'TIE_MAX_79'],
  ['B_PAIR', 'B'],
  ['P_PAIR', 'P'],
]

function BetSpots({
  enabledSides,
  tieLabel,
  tieEnabled,
  bets,
  onAdd,
  onClear,
}: {
  enabledSides: SideBetDef[]
  tieLabel: string
  /** false = 本線タイなしの台(TIE MAX等) */
  tieEnabled: boolean
  bets: Record<string, number>
  onAdd: (target: string) => void
  onClear: (target: string) => void
}) {
  const sideById = new Map(enabledSides.map((d) => [d.id, d]))
  const available = (id: string) =>
    id === 'T' ? tieEnabled : id === 'B' || id === 'P' || sideById.has(id)
  const templateRows = TABLE_LAYOUT.map((r) => r.filter(available)).filter((r) => r.length > 0)
  const used = new Set(templateRows.flat())
  const extras = enabledSides.filter((d) => !used.has(d.id)).map((d) => d.id)
  const extraRows: string[][] = []
  for (let i = 0; i < extras.length; i += 3) extraRows.push(extras.slice(i, i + 3))
  const rows = [...extraRows, ...templateRows]

  const meta = (id: string): { label: string; color: 'banker' | 'player' | 'tie' | 'gold'; small: boolean } => {
    if (id === 'B') return { label: 'バンカー', color: 'banker', small: false }
    if (id === 'P') return { label: 'プレイヤー', color: 'player', small: false }
    if (id === 'T') return { label: tieLabel, color: 'tie', small: true }
    const d = sideById.get(id)!
    const color =
      id === 'DRAGON_TIGER' || d.pairTarget === 'either'
        ? 'gold'
        : d.pairTarget === 'B' || d.side === 'B'
          ? 'banker'
          : d.pairTarget === 'P' || d.side === 'P'
            ? 'player'
            : 'gold'
    return { label: d.name, color, small: true }
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row, ri) => {
        // 主要スポット(B/P)を含む2枠行は3列中2列分に広げ、それ以外は枠数に合わせる
        const hasMain = row.includes('B') || row.includes('P')
        const colsClass =
          row.length === 1 ? 'grid-cols-1' : row.length === 2 && !hasMain ? 'grid-cols-2' : 'grid-cols-3'
        return (
        <div key={ri} className={`grid ${colsClass} gap-1.5`}>
          {row.map((id) => {
            const m = meta(id)
            const span = (id === 'B' || id === 'P') && row.length === 2 ? 'col-span-2' : ''
            return (
              <div key={id} className={span}>
                <BetSpot
                  label={m.label}
                  color={m.color}
                  small={m.small}
                  amount={bets[id] ?? 0}
                  onAdd={() => onAdd(id)}
                  onClear={() => onClear(id)}
                />
              </div>
            )
          })}
        </div>
        )
      })}
    </div>
  )
}

/** ペア有無の三値入力(null=未確認)。ベット中のサイドは選択必須 */
function PairPicker({
  label,
  value,
  onChange,
  accent,
  required,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean | null) => void
  accent: 'player' | 'banker'
  required: boolean
}) {
  const accentCls = accent === 'player' ? 'border-player text-player' : 'border-banker text-banker'
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className={`w-14 text-xs font-bold ${required ? '' : 'text-ink-2'}`}>
        {label}
        {required ? '*' : ''}
      </span>
      {([
        [false, 'なし'],
        [true, 'あり'],
      ] as const).map(([v, t]) => (
        <button
          key={t}
          className={`press h-12 flex-1 rounded-lg border text-sm font-bold ${
            value === v ? `${accentCls} bg-base-800` : 'border-base-700 bg-base-950 text-ink-2'
          }`}
          onClick={() => onChange(value === v ? null : v)}
        >
          {t}
        </button>
      ))}
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
    <div className={`relative rounded-xl border ${border} ${amount > 0 ? 'bg-base-800' : 'bg-base-900/70'}`}>
      <button className={`press w-full px-1 ${small ? 'h-12' : 'h-14'}`} onClick={onAdd}>
        <div className={`font-bold ${small ? 'text-[11px]' : 'text-sm'}`}>{label}</div>
        <div className={`num font-bold ${amount > 0 ? 'text-gold-300' : 'text-ink-3'} ${small ? 'text-xs' : 'text-sm'}`}>
          {amount > 0 ? fmtKrw(amount) : 'タップで賭け'}
        </div>
      </button>
      {amount > 0 && (
        <button
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-base-700 bg-base-800 text-xs text-ink"
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
 * 結果の補助入力シート。表示要否・必須/省略可は有効サイドベット構成と現在のベットから判定:
 * 勝者 → 勝ち側合計 → 勝ち側枚数 →(Dragon Tiger有効時のみ)負け側合計・枚数 → ペア有無。
 * 追加ステップが不要な構成では従来どおりタップと同時に自動登録される(3タップ以内を維持)。
 */
function ResultSheet({
  winner,
  sideBets,
  bets,
  rules,
  onCancel,
  onCommit,
}: {
  winner: Winner
  sideBets: SideBetDef[]
  bets: BetPlacement[]
  rules: MainBetRules
  onCancel: () => void
  onCommit: (input: HandInput) => void
}) {
  const [total, setTotal] = useState<number | null>(null)
  const [cards, setCards] = useState<2 | 3 | null>(null)
  const [loserTotal, setLoserTotal] = useState<number | null>(null)
  const [loserCards, setLoserCards] = useState<2 | 3 | null>(null)
  // ペアは三値(null=未確認)。ベット中のサイドは選択必須
  const [pPair, setPPair] = useState<boolean | null>(null)
  const [bPair, setBPair] = useState<boolean | null>(null)

  const tn = totalNeed(winner, sideBets, bets, rules)
  const cn = cardsNeed(winner, total, sideBets, bets, rules)
  const ln = loserNeed(winner, total, loserTotal, sideBets, bets)
  const pn = pairNeed(sideBets, bets)
  // ベット中ペアの側だけ必須にする(精算に不要な側は強制しない)
  const pairBetOn = (side: 'P' | 'B') =>
    sideBets.some(
      (d) =>
        d.enabled &&
        (d.pairTarget === side || d.pairTarget === 'either') &&
        bets.some((b) => b.target === d.id && b.amount > 0),
    )

  const name = winner === 'B' ? 'バンカー' : winner === 'P' ? 'プレイヤー' : 'タイ'
  const color = winner === 'B' ? 'text-banker' : winner === 'P' ? 'text-player' : 'text-tie'
  const totals = winner === 'T' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const isD7Choice = winner === 'B' && total === 7 && rules.bankerRule === 'ez'

  const build = (over: Partial<HandInput>): HandInput => ({
    winner,
    winnerTotal: total,
    winnerCards: cards,
    loserTotal,
    loserCards,
    pPair,
    bPair,
    ...over,
  })

  /** 追加ステップ(負け側・ペア)が無ければタップと同時に登録 */
  const autoCommitOk = (t: number | null) =>
    pn === 'none' && loserNeed(winner, t, null, sideBets, bets).total === 'none'

  const pickTotal = (n: number) => {
    setTotal(n)
    setCards(null)
    setLoserTotal(null)
    setLoserCards(null)
    if (cardsNeed(winner, n, sideBets, bets, rules) === 'none' && autoCommitOk(n)) {
      onCommit(build({ winnerTotal: n, winnerCards: null }))
    }
  }

  const pickCards = (c: 2 | 3) => {
    setCards(c)
    if (autoCommitOk(total)) {
      onCommit(build({ winnerCards: c }))
    }
  }

  // 手動登録ボタンの活性判定(必須項目がすべて入力済みか)
  const missing: string[] = []
  if (tn === 'required' && total == null) missing.push('勝利合計値')
  if (cn === 'required' && cards == null) missing.push('枚数')
  if (ln.total === 'required' && loserTotal == null) missing.push('負け側合計')
  if (ln.cards === 'required' && loserTotal != null && loserCards == null) missing.push('負け側枚数')
  if (pn === 'required') {
    if (pairBetOn('P') && pPair == null) missing.push('Pペア有無')
    if (pairBetOn('B') && bPair == null) missing.push('Bペア有無')
  }
  const showRegister = pn !== 'none' || ln.total !== 'none'

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onCancel}>
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-gold-600/40 bg-base-900/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-lg font-bold ${color}`}>{name}勝ち</span>
            <div className="flex items-center gap-1">
              {tn === 'optional' &&
                total == null &&
                !showRegister &&
                cardsNeed(winner, null, sideBets, bets, rules) === 'none' && (
                  <button
                    className="press h-12 rounded-lg border border-base-700 px-3 text-sm text-ink-2"
                    onClick={() => onCommit(build({ winnerTotal: null, winnerCards: null }))}
                  >
                    合計値を省略
                  </button>
                )}
              <button className="h-12 px-3 text-sm text-ink-3" onClick={onCancel}>
                キャンセル
              </button>
            </div>
          </div>

          {tn !== 'none' && (
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-2">
                {winner === 'T' ? 'タイの合計値' : '勝ち側の合計値'}
                {tn === 'required' ? '(必須)' : '(省略可)'}
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {totals.map((n) => (
                  <button
                    key={n}
                    className={`num press h-14 rounded-lg border text-lg font-bold ${
                      total === n ? 'btn-gold border-transparent' : 'border-base-700 bg-base-950'
                    }`}
                    onClick={() => pickTotal(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cn !== 'none' && (
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-2">
                {isD7Choice
                  ? 'バンカーの枚数(3枚 = ドラゴン7:バンカーベットはプッシュ)'
                  : `勝ち側の枚数${cn === 'required' ? '(必須)' : '(省略可)'}`}
              </span>
              <div className={`grid gap-1.5 ${cn === 'optional' && !showRegister ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  className={`press h-14 rounded-lg border bg-base-950 text-base font-bold ${
                    cards === 2 ? 'btn-gold border-transparent' : 'border-base-700'
                  }`}
                  onClick={() => pickCards(2)}
                >
                  2枚
                </button>
                <button
                  className={`press h-14 rounded-lg border bg-base-950 text-base font-bold ${
                    cards === 3 ? 'btn-gold border-transparent' : isD7Choice ? 'border-gold-500 text-gold-300' : 'border-base-700'
                  }`}
                  onClick={() => pickCards(3)}
                >
                  {isD7Choice ? '3枚(D7)' : '3枚'}
                </button>
                {cn === 'optional' && !showRegister && (
                  <button
                    className="press h-14 rounded-lg border border-base-700 bg-base-950 text-sm text-ink-2"
                    onClick={() => onCommit(build({ winnerCards: null }))}
                  >
                    省略
                  </button>
                )}
              </div>
            </div>
          )}

          {ln.total !== 'none' && (
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-2">
                負け側({winner === 'P' ? 'バンカー' : 'プレイヤー'})の合計値
                {ln.total === 'required' ? '(必須・ドラゴンタイガー判定)' : '(省略可)'}
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: total ?? 10 }, (_, n) => (
                  <button
                    key={n}
                    className={`num press h-12 rounded-lg border text-base font-bold ${
                      loserTotal === n ? 'btn-gold border-transparent' : 'border-base-700 bg-base-950'
                    }`}
                    onClick={() => {
                      setLoserTotal(n)
                      setLoserCards(null)
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loserTotal != null && ln.cards !== 'none' && (
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-2">
                負け側の枚数{ln.cards === 'required' ? '(必須・合計枚数で配当が変化)' : '(省略可)'}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {([2, 3] as const).map((c) => (
                  <button
                    key={c}
                    className={`press h-12 rounded-lg border bg-base-950 text-base font-bold ${
                      loserCards === c ? 'btn-gold border-transparent' : 'border-base-700'
                    }`}
                    onClick={() => setLoserCards(c)}
                  >
                    {c}枚{cards != null ? `(両者計${cards + c}枚)` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pn !== 'none' && (
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-2">
                ペア有無(最初の2枚が同ランク)
                {pn === 'required' ? '(ベット中のサイドは必須)' : '(省略可)'}
              </span>
              <PairPicker label="Pペア" value={pPair} onChange={setPPair} accent="player" required={pairBetOn('P')} />
              <PairPicker label="Bペア" value={bPair} onChange={setBPair} accent="banker" required={pairBetOn('B')} />
            </div>
          )}

          {showRegister && (
            <div>
              <button
                className="btn-gold press h-14 w-full rounded-xl text-base font-bold disabled:opacity-40"
                disabled={missing.length > 0}
                onClick={() => onCommit(build({}))}
              >
                {missing.length > 0 ? `${missing.join('・')}を入力してください` : 'このハンドを登録'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
