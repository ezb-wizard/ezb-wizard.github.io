import { useState } from 'react'
import { bankrollOf, useApp } from '../store'
import { fmtDateTime, fmtKrw, fmtSigned, krwToJpy, fmtJpy } from '../lib/money'
import { lossesToStopLoss, recommendedBet } from '../lib/bankroll'
import { useCountUp } from '../lib/useCountUp'

export default function Header() {
  const { rate, session, hands, settings, setTheoryOpen } = useApp()
  const bankroll = session ? bankrollOf(session, hands) : null
  const [logoOk, setLogoOk] = useState(true)

  return (
    <header className="border-b border-gold-600/30 bg-base-900/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-12 items-center justify-between px-3">
        <span className="flex min-w-0 items-center gap-2">
          {logoOk && (
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
              className="h-7 w-7 shrink-0 rounded-md object-contain"
              onError={() => setLogoOk(false)}
            />
          )}
          <span className="text-gold-grad truncate font-display text-sm font-bold tracking-wide">
            EZ Baccarat Wizard
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-gold-600/40 px-2 py-0.5 text-[10px] font-bold text-ink-2">
            {/* セッション中は開始時スナップショットのカジノを表示(設定変更に影響されない) */}
            {session
              ? session.casino
                ? session.casino === 'INSPIRE'
                  ? 'INSPIRE 仁川'
                  : 'PARADISE 仁川'
                : 'EZ(旧ルール)'
              : settings.casino === 'INSPIRE'
                ? 'INSPIRE 仁川'
                : 'PARADISE 仁川'}
          </span>
          <button
            className="press flex h-9 items-center rounded-full border border-gold-600 px-3 text-xs font-bold text-gold-300"
            onClick={() => setTheoryOpen(true)}
          >
            理論値
          </button>
        </div>
      </div>
      <div className="flex h-5 items-center justify-end px-3 pb-1">
        {rate ? (
          <span className="num text-[10px] text-ink-3">
            ¥1=₩{rate.rate.toFixed(2)}({fmtDateTime(rate.ts)}
            {rate.source === 'cache' ? '・キャッシュ' : rate.source === 'manual' ? '・手動' : ''})
          </span>
        ) : (
          <span className="text-[10px] text-ink-3">レート未取得</span>
        )}
      </div>
      {session && bankroll != null && (
        <SessionStrip
          bankroll={bankroll}
          pl={bankroll - session.startKrw}
          stopLossKrw={session.stopLossKrw}
          rate={rate?.rate ?? session.rate}
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
  const animBankroll = useCountUp(bankroll)
  const animPl = useCountUp(pl)
  const plJpy = krwToJpy(animPl, rate)
  return (
    <div className="grid grid-cols-3 gap-px border-t border-gold-600/20 bg-gold-600/20">
      <div className="bg-base-900 px-2 py-1.5">
        <div className="text-[10px] text-ink-3">現在資金</div>
        <div className="num text-base font-bold">{fmtKrw(animBankroll)}</div>
        <div className="num text-[10px] text-ink-2">
          {rate ? `約${fmtJpy(krwToJpy(animBankroll, rate)!)}` : '—'}
        </div>
      </div>
      <div className="bg-base-900 px-2 py-1.5">
        <div className="text-[10px] text-ink-3">セッション収支</div>
        <div className={`num text-base font-bold ${pl > 0 ? 'text-win' : pl < 0 ? 'text-lose' : ''}`}>
          {fmtSigned(animPl)}
        </div>
        <div className="num text-[10px] text-ink-2">
          {plJpy != null ? `約${plJpy >= 0 ? '+' : ''}${fmtJpy(plJpy)}` : '—'}
        </div>
      </div>
      <div className="bg-base-900 px-2 py-1.5">
        <div className="text-[10px] text-ink-3">ストップロスまで</div>
        <div className="num text-base font-bold">{toStop == null ? '未設定' : fmtKrw(Math.max(0, toStop))}</div>
        <div className="num text-[10px] text-ink-2">
          {losses == null ? '' : `推奨額であと${losses}連敗`}
        </div>
      </div>
    </div>
  )
}
