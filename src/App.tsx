import { useEffect, useState } from 'react'
import { bankrollOf, useApp } from './store'
import Header from './components/Header'
import TabBar from './components/TabBar'
import TheoryModal from './components/TheoryModal'
import SessionSetup from './components/SessionSetup'
import PlayScreen from './components/PlayScreen'
import StatsScreen from './components/StatsScreen'
import SimScreen from './components/SimScreen'
import SettingsScreen from './components/SettingsScreen'
import { getOutcomeTable } from './lib/baccarat'
import { fmtBoth, fmtSigned, krwToJpy, fmtJpy } from './lib/money'
import { Modal, PrimaryBtn, GhostBtn } from './components/ui'

export default function App() {
  const { ready, init, screen, session, hands, rate, lastSummary, clearSummary, endSession } = useApp()
  const [slDismissed, setSlDismissed] = useState(false)
  const [tpDismissed, setTpDismissed] = useState(false)

  useEffect(() => {
    void init()
    // 確率テーブルをアイドル時に事前計算(初回タップを速く)
    const id = setTimeout(() => getOutcomeTable(), 500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setSlDismissed(false)
    setTpDismissed(false)
  }, [session?.id])

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <span className="text-gold-400">読み込み中…</span>
      </div>
    )
  }

  const bankroll = session ? bankrollOf(session, hands) : null
  const slHit =
    session != null && bankroll != null && session.stopLossKrw != null && bankroll <= session.stopLossKrw
  const tpHit =
    session != null && bankroll != null && session.takeProfitKrw != null && bankroll >= session.takeProfitKrw

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        {screen === 'play' && (session ? <PlayScreen /> : <SessionSetup />)}
        {screen === 'stats' && <StatsScreen />}
        {screen === 'sim' && <SimScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
      <TabBar />
      <TheoryModal />

      {slHit && !slDismissed && (
        <LimitAlert
          kind="sl"
          bankroll={bankroll!}
          rate={rate?.rate ?? session!.rate}
          onContinue={() => setSlDismissed(true)}
          onEnd={() => void endSession()}
        />
      )}
      {tpHit && !tpDismissed && !slHit && (
        <LimitAlert
          kind="tp"
          bankroll={bankroll!}
          rate={rate?.rate ?? session!.rate}
          onContinue={() => setTpDismissed(true)}
          onEnd={() => void endSession()}
        />
      )}

      {lastSummary && (
        <Modal title="セッションサマリー" onClose={clearSummary}>
          <SessionSummary />
        </Modal>
      )}
    </div>
  )
}

/** ストップロス/テイクプロフィット到達の全画面アラート */
function LimitAlert({
  kind,
  bankroll,
  rate,
  onContinue,
  onEnd,
}: {
  kind: 'sl' | 'tp'
  bankroll: number
  rate: number | null
  onContinue: () => void
  onEnd: () => void
}) {
  const isSl = kind === 'sl'
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8 ${
        isSl ? 'bg-[#3d0b0b]/95' : 'bg-felt-900/95'
      }`}
    >
      <div className="text-5xl">{isSl ? '🛑' : '🎯'}</div>
      <h1 className={`text-2xl font-bold ${isSl ? 'text-banker' : 'text-gold-300'}`}>
        {isSl ? 'ストップロス到達' : 'テイクプロフィット到達'}
      </h1>
      <p className="num text-lg">{fmtBoth(bankroll, rate)}</p>
      <p className="text-center text-sm text-ink-2">
        {isSl
          ? '設定した損失限度に到達しました。ここで終了することを強く推奨します。'
          : '設定した利益目標に到達しました。利益を確保して終了することを推奨します。'}
      </p>
      <div className="w-full max-w-xs space-y-3">
        <PrimaryBtn onClick={onEnd}>セッションを終了する</PrimaryBtn>
        <GhostBtn onClick={onContinue}>{isSl ? '続行する(非推奨)' : '続行する'}</GhostBtn>
      </div>
    </div>
  )
}

function SessionSummary() {
  const { lastSummary: s, rate } = useApp()
  if (!s) return null
  const r = rate?.rate ?? s.rate
  const pl = (s.endKrw ?? s.startKrw) - s.startKrw
  const durMin = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : 0
  const plJpy = krwToJpy(pl, r)
  return (
    <div className="space-y-3 pb-2">
      <div className="rounded-xl bg-felt-950 p-4 text-center">
        <div className="text-xs text-ink-3">最終収支</div>
        <div className={`num text-3xl font-bold ${pl > 0 ? 'text-tie' : pl < 0 ? 'text-banker' : ''}`}>
          {fmtSigned(pl)}
        </div>
        <div className="num text-sm text-ink-2">
          {plJpy != null ? `約${plJpy >= 0 ? '+' : ''}${fmtJpy(plJpy)}` : ''}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-felt-950 p-3">
          <div className="text-[10px] text-ink-3">ハンド数</div>
          <div className="num text-lg font-bold">{s.handCount ?? 0}</div>
        </div>
        <div className="rounded-lg bg-felt-950 p-3">
          <div className="text-[10px] text-ink-3">プレイ時間</div>
          <div className="num text-lg font-bold">
            {Math.floor(durMin / 60)}:{String(durMin % 60).padStart(2, '0')}
          </div>
        </div>
        <div className="rounded-lg bg-felt-950 p-3">
          <div className="text-[10px] text-ink-3">終了資金</div>
          <div className="num text-sm font-bold">{fmtBoth(s.endKrw ?? 0, r)}</div>
        </div>
      </div>
    </div>
  )
}
