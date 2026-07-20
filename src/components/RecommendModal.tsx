import { useMemo } from 'react'
import { bankrollOf, latestCheckpointKrw, useApp } from '../store'
import { sessionRules } from '../types'
import { rankBets } from '../lib/recommend'
import { recommendedBet } from '../lib/bankroll'
import { fmtBoth, fmtKrw, fmtPct } from '../lib/money'
import { Modal } from './ui'

/**
 * 「今の一手」= 数学的推奨。勝者の予測ではなく、
 * どのベットが最も損しにくいか(控除率)と、資金保全上の適正額を即答する。
 */
export default function RecommendModal({ onClose }: { onClose: () => void }) {
  const { session, hands, checkpoints, rate, settings } = useApp()
  const rules = session ? sessionRules(session) : null
  const ranked = useMemo(
    () => (session && rules ? rankBets(rules, session.sideBets) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id],
  )
  if (!session || !rules || ranked.length === 0) return null

  const bankroll =
    settings.betTracking === true ? bankrollOf(session, hands) : latestCheckpointKrw(checkpoints, session.startKrw)
  const rec = recommendedBet(bankroll, settings.betPct, settings.chipUnit, session.tableMin)
  const best = ranked[0]
  const curRate = rate?.rate ?? session.rate

  return (
    <Modal title="今の一手(数学的推奨)" onClose={onClose}>
      <div className="space-y-3 pb-2">
        <div className="card-luxe p-3">
          <div className="text-[10px] text-ink-3">数学上の最適解</div>
          <div className="text-base font-bold text-ink">
            賭けない(期待損失 <span className="num">₩0</span>)
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
            すべてのベットは期待値マイナスのため、「見」が常に一番損をしません。
          </p>
        </div>

        <div className="card-luxe border-gold-500/60 p-3">
          <div className="text-[10px] text-ink-3">それでも賭けるなら(最も損しにくい一手)</div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span
              className={`text-xl font-bold ${
                best.target === 'B' ? 'text-banker' : best.target === 'P' ? 'text-player' : 'text-gold-300'
              }`}
            >
              {best.name}
            </span>
            <span className="num text-sm text-ink-2">控除率 {fmtPct(best.edge)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-base-800 pt-1">
            <span className="text-xs text-ink-3">推奨額(資金の{settings.betPct}%)</span>
            <span className="num text-base font-bold text-gold-300">{fmtBoth(rec.amount, curRate)}</span>
          </div>
          {rec.leaveTable && (
            <p className="mt-1 text-[10px] font-bold text-lose">
              推奨額がテーブル最小額未満です:テーブル離脱を推奨します
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-1 text-xs font-bold text-gold-300">全ベット先ランキング(損しにくい順)</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-ink-3">
                <th className="py-1 font-normal">#</th>
                <th className="py-1 font-normal">ベット先</th>
                <th className="py-1 text-right font-normal">勝率</th>
                <th className="py-1 text-right font-normal">控除率</th>
                <th className="py-1 text-right font-normal">10万₩あたり期待損失</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={r.target} className={`border-t border-base-800 ${i === 0 ? 'text-ink' : 'text-ink-2'}`}>
                  <td className="num py-1.5">{i + 1}</td>
                  <td className={`py-1.5 ${i === 0 ? 'font-bold' : ''}`}>{r.name}</td>
                  <td className="num py-1.5 text-right">{fmtPct(r.winProb, 1)}</td>
                  <td className={`num py-1.5 text-right ${r.edge > 0.1 ? 'text-lose' : ''}`}>{fmtPct(r.edge)}</td>
                  <td className={`num py-1.5 text-right ${r.edge > 0.1 ? 'text-lose' : ''}`}>
                    -{fmtKrw(r.edge * 100_000)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] leading-relaxed text-ink-3">
          ※ これは<b className="text-ink">勝者の予測ではありません</b>。次にどちらが勝つかは誰にも分からず、
          この順位と確率は出目に関係なく常に一定です(1ハンドごとの期待損失 = ベット額 × 控除率)。
          「どうせ賭けるなら数学的にマシな場所に、資金に見合った額で」というための表です。
        </p>
      </div>
    </Modal>
  )
}
