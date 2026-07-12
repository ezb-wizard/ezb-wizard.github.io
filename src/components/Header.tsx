import { bankrollOf, useApp } from '../store'
import { fmtDateTime, fmtKrw, fmtSigned, krwToJpy, fmtJpy } from '../lib/money'
import { lossesToStopLoss, recommendedBet } from '../lib/bankroll'

export default function Header() {
  const { rate, session, hands, settings, setTheoryOpen } = useApp()
  const bankroll = session ? bankrollOf(session, hands) : null

  return (
    <header className="border-b border-felt-700 bg-felt-900 pt-[env(safe-area-inset-top)]">
      <div className="flex h-11 items-center justify-between px-3">
        <span className="text-sm font-bold text-gold-400">EZバカラ</span>
        <div className="flex items-center gap-2">
          {rate ? (
            <span className="num text-[11px] text-ink-3">
              ¥1=₩{rate.rate.toFixed(2)}
              <span className="ml-1">
                ({fmtDateTime(rate.ts)}
                {rate.source === 'cache' ? '・キャッシュ' : rate.source === 'manual' ? '・手動' : ''})
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-ink-3">レート未取得</span>
          )}
          <button
            className="flex h-9 items-center rounded-full border border-gold-600 px-3 text-xs font-bold text-gold-300"
            onClick={() => setTheoryOpen(true)}
          >
            理論値
          </button>
        </div>
      </div>
      {session && bankroll != null && (
        <SessionStrip
          bankroll={bankroll}
          pl={bankroll - session.startKrw}
          stopLossKrw={session.stopLossKrw}
          rate={session ? (rate?.rate ?? session.rate) : null}
          betPct={settings.betPct}
          chipUnit={settings.chipUnit}
          tableMin={session.tableMin}
        />
      )}
    </header>
  )
}

function SessionStrip({
  bankroll,
  pl,
  stopLossKrw,
  rate,
  betPct,
  chipUnit,
  tableMin,
}: {
  bankroll: number
  pl: number
  stopLossKrw: number | null
  rate: number | null
  betPct: number
  chipUnit: number
  tableMin: number
}) {
  const rec = recommendedBet(bankroll, betPct, chipUnit, tableMin)
  const losses = lossesToStopLoss(bankroll, stopLossKrw, rec.amount)
  const toStop = stopLossKrw == null ? null : bankroll - stopLossKrw
  const plJpy = krwToJpy(pl, rate)
  return (
    <div className="grid grid-cols-3 gap-px bg-felt-700">
      <div className="bg-felt-900 px-2 py-1.5">
        <div className="text-[10px] text-ink-3">現在資金</div>
        <div className="num text-sm font-bold">{fmtKrw(bankroll)}</div>
        <div className="num text-[10px] text-ink-2">
          {rate ? `約${fmtJpy(krwToJpy(bankroll, rate)!)}` : '—'}
        </div>
      </div>
      <div className="bg-felt-900 px-2 py-1.5">
        <div className="text-[10px] text-ink-3">セッション収支</div>
        <div className={`num text-sm font-bold ${pl > 0 ? 'text-tie' : pl < 0 ? 'text-banker' : ''}`}>
          {fmtSigned(pl)}
        </div>
        <div className="num text-[10px] text-ink-2">
          {plJpy != null ? `約${plJpy >= 0 ? '+' : ''}${fmtJpy(plJpy)}` : '—'}
        </div>
      </div>
      <div className="bg-felt-900 px-2 py-1.5">
        <div className="text-[10px] text-ink-3">ストップロスまで</div>
        <div className="num text-sm font-bold">{toStop == null ? '未設定' : fmtKrw(Math.max(0, toStop))}</div>
        <div className="num text-[10px] text-ink-2">
          {losses == null ? '' : `推奨額であと${losses}連敗`}
        </div>
      </div>
    </div>
  )
}
