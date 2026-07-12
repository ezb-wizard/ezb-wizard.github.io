import { useMemo } from 'react'
import { useApp } from '../store'
import { getTheoreticalStats, mainBetEdges } from '../lib/baccarat'
import { casinoConfig, CASINO_NAMES } from '../lib/casinos'
import { sideBetStats } from '../lib/sidebets'
import { sessionRules, type MainBetRules, type SideBetDef } from '../types'
import { fmtPct } from '../lib/money'
import { Modal } from './ui'

/** どの画面からも1タップで開ける理論確率・控除率リファレンス */
export default function TheoryModal() {
  const { theoryOpen, setTheoryOpen, session, settings } = useApp()
  if (!theoryOpen) return null

  const casino = session?.casino ?? settings.casino ?? 'PARADISE'
  const rules = session ? sessionRules(session) : casinoConfig(settings).mainBets
  const sideBets = session?.sideBets ?? casinoConfig(settings).sideBets

  return (
    <Modal title={`理論値(8デッキ完全列挙 / ${CASINO_NAMES[casino]})`} onClose={() => setTheoryOpen(false)}>
      <TheoryContent rules={rules} sideBets={sideBets} />
    </Modal>
  )
}

export function TheoryContent({ rules, sideBets }: { rules: MainBetRules; sideBets: SideBetDef[] }) {
  const t = useMemo(() => getTheoreticalStats(), [])
  const edges = useMemo(() => mainBetEdges(rules), [rules])
  const enabled = sideBets.filter((d) => d.enabled)
  const sideRows = useMemo(
    () => enabled.map((d) => ({ def: d, stats: sideBetStats(d) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(enabled)],
  )

  const Row = ({ name, prob, edge, note }: { name: string; prob?: number; edge?: number; note?: string }) => (
    <tr className="border-b border-base-800">
      <td className="py-2 pr-2 text-sm">{name}</td>
      <td className="num py-2 pr-2 text-right text-sm">{prob != null ? fmtPct(prob) : '—'}</td>
      <td className={`num py-2 text-right text-sm ${edge != null && edge > 0.05 ? 'text-lose' : ''}`}>
        {edge != null ? fmtPct(edge) : '—'}
      </td>
      <td className="py-2 pl-2 text-right text-[10px] text-ink-3">{note ?? ''}</td>
    </tr>
  )

  return (
    <div className="space-y-4">
      <table className="w-full">
        <thead>
          <tr className="text-left text-[10px] text-ink-3">
            <th className="py-1 font-normal">ベット</th>
            <th className="py-1 text-right font-normal">出現率</th>
            <th className="py-1 text-right font-normal">控除率</th>
            <th className="py-1 text-right font-normal">配当</th>
          </tr>
        </thead>
        <tbody>
          <Row
            name="バンカー"
            prob={t.pBanker}
            edge={edges.banker}
            note={rules.bankerRule === 'ez' ? '1:1(D7プッシュ)' : `${rules.bankerPayout}:1`}
          />
          <Row name="プレイヤー" prob={t.pPlayer} edge={edges.player} note={`${rules.playerPayout}:1`} />
          <Row name={`タイ(${rules.tiePayout}:1)`} prob={t.pTie} edge={edges.tie} note={`${rules.tiePayout}:1`} />
          {rules.bankerRule === 'ez' && (
            <Row name="ドラゴン7(参考)" prob={t.pDragon7} edge={t.edgeDragon7} note="40:1" />
          )}
        </tbody>
      </table>

      {sideRows.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-bold text-gold-300">
            サイドベット控除率(設定中の配当から動的算出)
          </h3>
          <table className="w-full">
            <tbody>
              {sideRows.map(({ def, stats }) => (
                <Row
                  key={def.id}
                  name={def.name}
                  prob={stats.winProb}
                  edge={stats.edge}
                  note={def.rules.map((r) => `${r.payout}:1`).join(' / ')}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card-luxe space-y-2 p-3 text-[11px] leading-relaxed text-ink-2">
        <p>
          バカラの各ハンドは<b className="text-ink">独立試行</b>です。過去の出目は次のハンドに一切影響せず、
          控除率は常に固定です。次の結果を予測する方法は存在しません。
        </p>
        <p>
          期待値がマイナスのゲームでは賭け金の最適化は成立しません。推奨ベット額は
          <b className="text-ink">資金保全と時間管理のための基準</b>です。
        </p>
        <p className="text-lose">
          サイドベットの控除率は本線より大幅に高い点に注意してください。
        </p>
      </div>
    </div>
  )
}
