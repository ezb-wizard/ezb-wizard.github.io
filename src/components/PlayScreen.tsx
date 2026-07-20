import { useEffect, useMemo, useState } from 'react'
import { bankrollOf, latestCheckpointKrw, useApp } from '../store'
import {
  sessionRules,
  type BetPlacement,
  type Checkpoint,
  type Hand,
  type HandInput,
  type MainBetRules,
  type SideBetDef,
  type Winner,
} from '../types'
import { cardsNeed, loserNeed, pairNeed, settleHand, totalNeed } from '../lib/settle'
import { recommendedBet } from '../lib/bankroll'
import { getTheoreticalStats } from '../lib/baccarat'
import { rankBets } from '../lib/recommend'
import { quickOutcomes } from '../lib/quickOutcomes'
import { logicalStreaks } from '../lib/road'
import { fmtBoth, fmtKrw, fmtPct, fmtSigned } from '../lib/money'
import { Confirm, Field, GhostBtn, Modal, NumInput, PrimaryBtn } from './ui'
import HandEditModal from './HandEditModal'
import RoadsModal from './RoadsModal'
import RecommendModal from './RecommendModal'

const DEFAULT_CHIPS = [100_000, 500_000, 1_000_000, 5_000_000]

export default function PlayScreen() {
  const {
    session,
    hands,
    checkpoints,
    shoe,
    rate,
    settings,
    addHand,
    undoLast,
    endSession,
    updateSettings,
    nextShoe,
  } = useApp()
  const quick = settings.quickMode !== false
  // 結果のみ記録モード(既定): ベット額の入力UIを出さず、資金はチェックポイント手入力で管理
  const betTracking = settings.betTracking === true

  const chips = settings.chipPresets?.length === 4 ? settings.chipPresets : DEFAULT_CHIPS
  const [chip, setChip] = useState(() => chips[0])
  const [customChip, setCustomChip] = useState(false)
  const [bets, setBets] = useState<Record<string, number>>({})
  const [entryWinner, setEntryWinner] = useState<Winner | null>(null)
  const [pendingInput, setPendingInput] = useState<HandInput | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmShoe, setConfirmShoe] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [roadsOpen, setRoadsOpen] = useState(false)
  const [recommendOpen, setRecommendOpen] = useState(false)
  const [cpOpen, setCpOpen] = useState(false)
  const [endKrwInput, setEndKrwInput] = useState<number | null>(null)
  const [flash, setFlash] = useState<{ kind: 'win' | 'lose' | 'push'; key: number } | null>(null)
  // リマインダー用の現在時刻(30秒ごとに更新)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  if (!session) return null
  const rules = sessionRules(session)
  const enabledSides = session.sideBets.filter((d) => d.enabled)
  const shoeHands = hands.filter((h) => (h.shoe ?? 1) === shoe)
  const bankroll = betTracking
    ? bankrollOf(session, hands)
    : latestCheckpointKrw(checkpoints, session.startKrw)
  const curRate = rate?.rate ?? session.rate
  const lastCp = checkpoints.length ? checkpoints[checkpoints.length - 1] : null
  const reminderMin = settings.checkpointReminderMin ?? 60
  const needReminder =
    !betTracking && reminderMin > 0 && lastCp != null && now - lastCp.ts >= reminderMin * 60_000

  const betList: BetPlacement[] = betTracking
    ? Object.entries(bets)
        .filter(([, v]) => v > 0)
        .map(([target, amount]) => ({ target, amount }))
    : []
  const betTotal = betList.reduce((s, b) => s + b.amount, 0)

  const addChip = (target: string) => setBets((b) => ({ ...b, [target]: (b[target] ?? 0) + chip }))
  const clearSpot = (target: string) => setBets((b) => ({ ...b, [target]: 0 }))

  /** クイック登録では省略可(optional)の入力を自動スキップし、精算に必須のものだけ尋ねる */
  const adjNeed = (n: ReturnType<typeof totalNeed>) => (quick && n === 'optional' ? 'none' : n)
  const onResult = (winner: Winner) => {
    const needsSheet =
      adjNeed(totalNeed(winner, enabledSides, betList, rules)) !== 'none' ||
      adjNeed(cardsNeed(winner, null, enabledSides, betList, rules)) !== 'none' ||
      adjNeed(loserNeed(winner, null, null, enabledSides, betList).total) !== 'none' ||
      adjNeed(pairNeed(enabledSides, betList)) !== 'none'
    if (!needsSheet) {
      requestCommit({
        winner,
        winnerTotal: null,
        winnerCards: null,
        loserTotal: null,
        loserCards: null,
        pPair: null,
        bPair: null,
      })
    } else {
      setEntryWinner(winner)
    }
  }

  /** 誤操作防止:現在資金の10%超のベットは確認ダイアログ(ベット記録モードのみ) */
  const requestCommit = (input: HandInput) => {
    if (betTracking && betTotal > bankroll * 0.1 && betTotal > 0) {
      setPendingInput(input)
    } else {
      commit(input)
    }
  }

  const commit = (input: HandInput) => {
    // 勝敗登録時の色フラッシュ+ハプティクス(対応端末のみ)
    if (betList.length > 0) {
      const net = settleHand(betList, input, { mainBets: rules, sideBets: session.sideBets })
      setFlash({ kind: net > 0 ? 'win' : net < 0 ? 'lose' : 'push', key: (flash?.key ?? 0) + 1 })
    } else {
      setFlash({ kind: 'push', key: (flash?.key ?? 0) + 1 })
    }
    try {
      navigator.vibrate?.(15)
    } catch {
      /* 非対応端末は無視 */
    }
    void addHand(input, betList)
  }

  const quicks = quickOutcomes(session.sideBets)
  const last = hands[hands.length - 1]

  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      {flash && <div key={flash.key} className={`pointer-events-none fixed inset-0 z-30 flash-${flash.kind}`} />}

      {/* 残高記録リマインダー */}
      {needReminder && (
        <button
          className="press flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gold-500 bg-gold-500/10 text-sm font-bold text-gold-300"
          onClick={() => setCpOpen(true)}
        >
          ⏰ 前回の残高記録から{Math.floor((now - (lastCp?.ts ?? now)) / 60_000)}分 — 残高を記録しましょう
        </button>
      )}

      {/* 確率・推奨パネル(登録のたびに即時更新) */}
      <ProbRecoPanel
        rules={rules}
        sideBets={session.sideBets}
        shoeHands={shoeHands}
        allHands={hands}
        shoe={shoe}
        bankroll={bankroll}
        checkpoints={checkpoints}
        startedAt={session.startedAt}
        startKrw={session.startKrw}
        stopLossKrw={session.stopLossKrw}
        rate={curRate}
        betPct={settings.betPct}
        chipUnit={settings.chipUnit}
        tableMin={session.tableMin}
        betTracking={betTracking}
        onOpenCheckpoint={() => setCpOpen(true)}
        onOpenRecommend={() => setRecommendOpen(true)}
      />

      {/* 履歴 */}
      <div className="card-luxe flex-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-bold text-ink-2">
            履歴(シュー{shoe}: {shoeHands.length} / 計{hands.length})
          </span>
          <div className="flex gap-1.5">
            <button
              className="press h-10 rounded-lg border border-gold-600/40 px-2.5 text-xs font-bold text-gold-300"
              onClick={() => setConfirmShoe(true)}
            >
              シュー切替
            </button>
            <button
              className="press h-10 rounded-lg border border-gold-600/40 px-2.5 text-xs font-bold text-gold-300"
              onClick={() => setRoadsOpen(true)}
            >
              罫線
            </button>
            {last && (
              <button
                className="press h-10 rounded-lg border border-gold-600/40 px-2.5 text-xs font-bold text-gold-300"
                onClick={() => void undoLast()}
              >
                ↩
              </button>
            )}
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto">
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
                {(h.shoe ?? 1) !== shoe && <span className="ml-1 text-ink-3">シュー{h.shoe ?? 1}</span>}
              </span>
              <span className={`num text-sm font-bold ${h.net > 0 ? 'text-win' : h.net < 0 ? 'text-lose' : 'text-ink-3'}`}>
                {h.bets.length === 0 ? '—' : fmtSigned(h.net)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <GhostBtn onClick={() => setCpOpen(true)}>+ 残高を記録</GhostBtn>
        <GhostBtn onClick={() => setConfirmEnd(true)}>セッション終了</GhostBtn>
      </div>

      {/* 操作クラスタ(親指リーチ優先で画面下部に固定) */}
      <div className="sticky bottom-0 z-20 -mx-3 -mb-3 space-y-1.5 border-t border-gold-600/25 bg-base-950/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button
            className={`press flex h-9 items-center gap-1 rounded-full border px-3 text-[11px] font-bold ${
              quick ? 'border-gold-500 text-gold-300' : 'border-base-700 text-ink-3'
            }`}
            onClick={() => void updateSettings({ quickMode: !quick })}
          >
            ⚡ クイック登録 {quick ? 'ON' : 'OFF'}
          </button>
          <span className="text-[10px] text-ink-3">
            {quick ? '精算に必要な入力のみ・見はワンタップ' : '省略可の入力もすべて表示'}
          </span>
        </div>

        {/* ベット額の記録UI(設定「ベット額も記録」時のみ表示) */}
        {betTracking && (
          <>
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
          </>
        )}

        {/* サイドベット系ワンタップ結果(例: SD=P2枚7勝ち。B/P勝ちとしても自動集計) */}
        {quicks.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {quicks.slice(0, 8).map((q) => (
              <button
                key={q.id}
                className={`press h-12 rounded-lg border text-sm font-bold ${
                  q.side === 'B' ? 'border-banker text-banker' : 'border-player text-player'
                } bg-base-900`}
                title={q.name}
                onClick={() => requestCommit(q.input)}
              >
                {q.short}
              </button>
            ))}
          </div>
        )}

        {/* 結果ボタン */}
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
          quick={quick}
          onCancel={() => setEntryWinner(null)}
          onCommit={(input) => {
            setEntryWinner(null)
            requestCommit(input)
          }}
        />
      )}

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

      {confirmShoe && (
        <Confirm
          message={`シュー${shoe + 1}に切り替えますか?`}
          detail="罫線とシュー内統計が新しくなります(これまでの記録はすべて保持されます)"
          okLabel="切り替える"
          onOk={() => {
            setConfirmShoe(false)
            nextShoe()
          }}
          onCancel={() => setConfirmShoe(false)}
        />
      )}

      {confirmEnd &&
        (betTracking ? (
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
        ) : (
          <Modal
            title="セッションを終了"
            onClose={() => setConfirmEnd(false)}
            footer={
              <PrimaryBtn
                className="h-12"
                onClick={() => {
                  setConfirmEnd(false)
                  void endSession(endKrwInput ?? (lastCp ? lastCp.krw : undefined))
                  setEndKrwInput(null)
                }}
              >
                終了する
              </PrimaryBtn>
            }
          >
            <div className="space-y-2 pb-2">
              <Field label={`終了時の資金(KRW)/ 開始 ${fmtKrw(session.startKrw)}`}>
                <NumInput
                  value={endKrwInput}
                  onChange={setEndKrwInput}
                  placeholder={(lastCp?.krw ?? session.startKrw).toLocaleString('ja-JP')}
                />
              </Field>
              <p className="text-[10px] leading-relaxed text-ink-3">
                未入力の場合は最新チェックポイント({lastCp ? fmtKrw(lastCp.krw) : '開始資金'})を終了資金として
                収支を記録します。{hands.length}ハンドの出目記録はどちらでも保存されます。
              </p>
            </div>
          </Modal>
        ))}

      {cpOpen && <CheckpointModal onClose={() => setCpOpen(false)} />}
      {editingId != null && <HandEditModal handId={editingId} onClose={() => setEditingId(null)} />}
      {roadsOpen && <RoadsModal hands={shoeHands} onClose={() => setRoadsOpen(false)} />}
      {recommendOpen && <RecommendModal onClose={() => setRecommendOpen(false)} />}
    </div>
  )
}

/**
 * 確率・推奨パネル(常設・毎ハンド即時更新)。
 * 理論確率は固定であり、シュー内実績・連は事実表示のみ(次の結果の予測には使えない)。
 */
function ProbRecoPanel({
  rules,
  sideBets,
  shoeHands,
  allHands,
  shoe,
  bankroll,
  checkpoints,
  startedAt,
  startKrw,
  stopLossKrw,
  rate,
  betPct,
  chipUnit,
  tableMin,
  betTracking,
  onOpenCheckpoint,
  onOpenRecommend,
}: {
  rules: MainBetRules
  sideBets: SideBetDef[]
  shoeHands: Hand[]
  allHands: Hand[]
  shoe: number
  bankroll: number
  checkpoints: Checkpoint[]
  startedAt: number
  startKrw: number
  stopLossKrw: number | null
  rate: number | null
  betPct: number
  chipUnit: number
  tableMin: number
  betTracking: boolean
  onOpenCheckpoint: () => void
  onOpenRecommend: () => void
}) {
  const t = getTheoreticalStats()
  const best = useMemo(
    () => rankBets(rules, sideBets)[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules, JSON.stringify(sideBets.filter((d) => d.enabled).map((d) => d.id))],
  )
  const rec = recommendedBet(bankroll, betPct, chipUnit, tableMin)

  // シュー内実績と連(事実表示のみ)
  const n = shoeHands.length
  const c: Record<Winner, number> = { B: 0, P: 0, T: 0 }
  for (const h of shoeHands) c[h.winner]++
  const lastW = n ? shoeHands[n - 1].winner : null
  let streak = 0
  if (lastW) {
    if (lastW === 'T') {
      for (let i = n - 1; i >= 0 && shoeHands[i].winner === 'T'; i--) streak++
    } else {
      for (let i = n - 1; i >= 0; i--) {
        const w = shoeHands[i].winner
        if (w === 'T') continue
        if (w === lastW) streak++
        else break
      }
    }
  }
  const maxStreak = Math.max(0, ...logicalStreaks(allHands))

  // 資金:直近1時間の増減と時給換算
  const hourAgo = Date.now() - 3_600_000
  const cpBefore = [...checkpoints].reverse().find((x) => x.ts <= hourAgo) ?? checkpoints[0]
  const hourDelta = cpBefore ? bankroll - cpBefore.krw : null
  const elapsedH = Math.max(0.25, (Date.now() - startedAt) / 3_600_000)
  const perHour = (bankroll - startKrw) / elapsedH
  const lastCp = checkpoints.length ? checkpoints[checkpoints.length - 1] : null
  const slClose = stopLossKrw != null && bankroll - stopLossKrw <= rec.amount * 3

  const pct = (x: number) => (n > 0 ? `${((x / n) * 100).toFixed(0)}%` : '-')
  const time = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="card-luxe space-y-1.5 p-3">
      {/* 理論確率(固定) */}
      <div className="num flex items-center gap-3 text-[11px] text-ink-2">
        <span className="text-[10px] text-ink-3">理論(固定)</span>
        <span className="font-bold text-banker">B {fmtPct(t.pBanker, 1)}</span>
        <span className="font-bold text-player">P {fmtPct(t.pPlayer, 1)}</span>
        <span className="font-bold text-tie">T {fmtPct(t.pTie, 1)}</span>
        <button className="press ml-auto text-[10px] font-bold text-gold-300 underline" onClick={onOpenRecommend}>
          期待値一覧
        </button>
      </div>
      {/* ベストベットと推奨額 */}
      <div className="flex items-baseline justify-between border-t border-base-800 pt-1.5">
        <span className="text-xs">
          <span className="text-ink-3">ベスト: </span>
          <b className={best.target === 'B' ? 'text-banker' : best.target === 'P' ? 'text-player' : 'text-gold-300'}>
            {best.name}
          </b>
          <span className="num ml-1 text-[10px] text-ink-3">(1万₩あたり −{fmtKrw(best.edge * 10_000)})</span>
        </span>
        <span className="num text-sm font-bold text-gold-300">{fmtBoth(rec.amount, rate)}</span>
      </div>
      {/* シュー内実績・連(事実のみ) */}
      <div className="num flex items-center gap-3 border-t border-base-800 pt-1.5 text-[11px]">
        <span className="text-[10px] text-ink-3">シュー{shoe}</span>
        <span className="font-bold text-banker">B {c.B}<span className="font-normal text-ink-3">({pct(c.B)})</span></span>
        <span className="font-bold text-player">P {c.P}<span className="font-normal text-ink-3">({pct(c.P)})</span></span>
        <span className="font-bold text-tie">T {c.T}</span>
        {lastW && (
          <span className={`ml-auto font-bold ${lastW === 'B' ? 'text-banker' : lastW === 'P' ? 'text-player' : 'text-tie'}`}>
            {lastW}{streak}連
          </span>
        )}
        <span className="text-[10px] text-ink-3">最長{maxStreak}連</span>
      </div>
      {/* 資金(チェックポイント) */}
      <div className="num flex items-center gap-2 border-t border-base-800 pt-1.5 text-[11px]">
        <span className="text-[10px] text-ink-3">資金</span>
        <span className="font-bold">{fmtKrw(bankroll)}</span>
        {!betTracking && lastCp && <span className="text-[10px] text-ink-3">({time(lastCp.ts)}時点)</span>}
        {hourDelta != null && (
          <span className={`text-[10px] ${hourDelta > 0 ? 'text-win' : hourDelta < 0 ? 'text-lose' : 'text-ink-3'}`}>
            1h {fmtSigned(hourDelta)}
          </span>
        )}
        <span className={`text-[10px] ${perHour < 0 ? 'text-lose' : 'text-ink-3'}`}>時給 {fmtSigned(perHour)}</span>
        {!betTracking && (
          <button className="press ml-auto text-[10px] font-bold text-gold-300 underline" onClick={onOpenCheckpoint}>
            +記録
          </button>
        )}
      </div>
      {slClose && (
        <p className="rounded bg-[#31090c] px-2 py-1 text-[11px] font-bold text-lose">
          ⚠ 撤退シグナル: ストップロスまで残り {fmtKrw(Math.max(0, bankroll - (stopLossKrw ?? 0)))}
        </p>
      )}
      <p className="text-[9px] leading-relaxed text-ink-3">
        実績・連は事実の記録であり、次のハンドの確率は変わりません(独立試行・予測不可)。
      </p>
    </div>
  )
}

/** 資金チェックポイントの追加(残高+時刻、3操作以内) */
function CheckpointModal({ onClose }: { onClose: () => void }) {
  const { addCheckpoint, checkpoints, rate } = useApp()
  const [krw, setKrw] = useState<number | null>(null)
  const [timeStr, setTimeStr] = useState(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  const lastCp = checkpoints.length ? checkpoints[checkpoints.length - 1] : null

  const save = () => {
    if (krw == null || krw < 0) return
    const now = new Date()
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    // 時刻を変更していなければ秒付きの現在時刻を使う(同分の他CPより確実に後に並ぶ)
    let ts = Date.now()
    if (timeStr !== nowStr) {
      const [h, m] = timeStr.split(':').map(Number)
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        now.setHours(h, m, 0, 0)
        ts = now.getTime()
      }
    }
    void addCheckpoint(krw, ts)
    onClose()
  }

  return (
    <Modal
      title="残高を記録"
      onClose={onClose}
      footer={
        <PrimaryBtn className="h-12" onClick={save} disabled={krw == null}>
          登録
        </PrimaryBtn>
      }
    >
      <div className="space-y-3 pb-2">
        <Field label="現在の残高(KRW)">
          <NumInput
            value={krw}
            onChange={setKrw}
            placeholder={lastCp ? lastCp.krw.toLocaleString('ja-JP') : ''}
          />
          {krw != null && rate && (
            <span className="num mt-1 block text-right text-xs text-ink-2">{fmtBoth(krw, rate.rate)}</span>
          )}
        </Field>
        <Field label="時刻">
          <input
            type="time"
            className="num h-12 w-full rounded-lg border border-base-700 bg-base-950 px-3 text-ink focus:border-gold-500 focus:outline-none"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
          />
        </Field>
        {lastCp && (
          <p className="num text-[10px] text-ink-3">
            前回: {fmtKrw(lastCp.krw)}(
            {new Date(lastCp.ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})
          </p>
        )}
      </div>
    </Modal>
  )
}

/** セッションのライブ統計は ProbRecoPanel に統合済み */

/**
 * ベットスポット。実テーブル(Dragon Tiger Baccarat)と同じ配置。
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
  tieEnabled: boolean
  bets: Record<string, number>
  onAdd: (target: string) => void
  onClear: (target: string) => void
}) {
  const sideById = new Map(enabledSides.map((d) => [d.id, d]))
  const available = (id: string) => (id === 'T' ? tieEnabled : id === 'B' || id === 'P' || sideById.has(id))
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
 * 追加ステップが不要な構成では従来どおりタップと同時に自動登録される。
 */
function ResultSheet({
  winner,
  sideBets,
  bets,
  rules,
  quick,
  onCancel,
  onCommit,
}: {
  winner: Winner
  sideBets: SideBetDef[]
  bets: BetPlacement[]
  rules: MainBetRules
  quick: boolean
  onCancel: () => void
  onCommit: (input: HandInput) => void
}) {
  const [total, setTotal] = useState<number | null>(null)
  const [cards, setCards] = useState<2 | 3 | null>(null)
  const [loserTotal, setLoserTotal] = useState<number | null>(null)
  const [loserCards, setLoserCards] = useState<2 | 3 | null>(null)
  const [pPair, setPPair] = useState<boolean | null>(null)
  const [bPair, setBPair] = useState<boolean | null>(null)

  type Need = ReturnType<typeof pairNeed>
  const adj = (nd: Need): Need => (quick && nd === 'optional' ? 'none' : nd)
  const tn = adj(totalNeed(winner, sideBets, bets, rules))
  const cn = adj(cardsNeed(winner, total, sideBets, bets, rules))
  const lnRaw = loserNeed(winner, total, loserTotal, sideBets, bets)
  const ln = { total: adj(lnRaw.total), cards: adj(lnRaw.cards) }
  const pn = adj(pairNeed(sideBets, bets))
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

  const autoCommitOk = (t: number | null) =>
    pn === 'none' && adj(loserNeed(winner, t, null, sideBets, bets).total) === 'none'

  const pickTotal = (nv: number) => {
    setTotal(nv)
    setCards(null)
    setLoserTotal(null)
    setLoserCards(null)
    if (adj(cardsNeed(winner, nv, sideBets, bets, rules)) === 'none' && autoCommitOk(nv)) {
      onCommit(build({ winnerTotal: nv, winnerCards: null }))
    }
  }

  const pickCards = (cv: 2 | 3) => {
    setCards(cv)
    if (autoCommitOk(total)) {
      onCommit(build({ winnerCards: cv }))
    }
  }

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
              {tn === 'optional' && total == null && !showRegister && (
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
                {totals.map((nv) => (
                  <button
                    key={nv}
                    className={`num press h-14 rounded-lg border text-lg font-bold ${
                      total === nv ? 'btn-gold border-transparent' : 'border-base-700 bg-base-950'
                    }`}
                    onClick={() => pickTotal(nv)}
                  >
                    {nv}
                  </button>
                ))}
              </div>
            </div>
          )}

          {total != null && cn !== 'none' && (
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

          {total != null && ln.total !== 'none' && (
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-2">
                負け側({winner === 'P' ? 'バンカー' : 'プレイヤー'})の合計値
                {ln.total === 'required' ? '(必須・ドラゴンタイガー判定)' : '(省略可)'}
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: total }, (_, nv) => (
                  <button
                    key={nv}
                    className={`num press h-12 rounded-lg border text-base font-bold ${
                      loserTotal === nv ? 'btn-gold border-transparent' : 'border-base-700 bg-base-950'
                    }`}
                    onClick={() => {
                      setLoserTotal(nv)
                      setLoserCards(null)
                    }}
                  >
                    {nv}
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
                {([2, 3] as const).map((cv) => (
                  <button
                    key={cv}
                    className={`press h-12 rounded-lg border bg-base-950 text-base font-bold ${
                      loserCards === cv ? 'btn-gold border-transparent' : 'border-base-700'
                    }`}
                    onClick={() => setLoserCards(cv)}
                  >
                    {cv}枚{cards != null ? `(両者計${cards + cv}枚)` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pn !== 'none' && (
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-2">
                ペア有無(最初の2枚が同ランク){pn === 'required' ? '(ベット中の側は必須)' : ''}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  className={`press h-12 rounded-lg border text-sm font-bold ${
                    pPair ? 'border-player bg-base-800 text-player' : 'border-base-700 bg-base-950 text-ink-2'
                  }`}
                  onClick={() => setPPair((v) => !v)}
                >
                  Pペア {pPair ? 'あり' : 'なし'}
                </button>
                <button
                  className={`press h-12 rounded-lg border text-sm font-bold ${
                    bPair ? 'border-banker bg-base-800 text-banker' : 'border-base-700 bg-base-950 text-ink-2'
                  }`}
                  onClick={() => setBPair((v) => !v)}
                >
                  Bペア {bPair ? 'あり' : 'なし'}
                </button>
              </div>
            </div>
          )}

          {showRegister && (
            <button
              className="btn-gold press h-14 w-full rounded-xl text-base font-bold disabled:opacity-40"
              disabled={missing.length > 0}
              onClick={() => onCommit(build({}))}
            >
              {missing.length > 0 ? `${missing.join('・')}を入力してください` : 'このハンドを登録'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
