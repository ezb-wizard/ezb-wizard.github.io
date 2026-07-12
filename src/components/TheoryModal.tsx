import { useMemo } from 'react'
import { useApp } from '../store'
import { getTheoreticalStats } from '../lib/baccarat'
import { presetSideBets, sideBetStats } from '../lib/sidebets'
import { fmtPct } from '../lib/money'
import { Modal } from './ui'

/** どの画面からも1タップで開ける理論確率・控除率リファレンス */
export default function TheoryModal() {
  const { theoryOpen, setTheoryOpen, session } = useApp()
  if (!theoryOpen) return null
  return (
    <Modal title="EZバカラ理論値(8デッキ完全列挙)" onClose={() => setTheoryOpen(false)}>
      <TheoryContent activeSideBets={session?.sideBets ?? null} tiePayout={session?.tiePayout ?? 8} />
    </Modal>
  )
}

export function TheoryContent({
  activeSideBets,
  tiePayout,
}: {
  activeSideBets: import('../types').SideBetDef[] | null
  tiePayout: 8 | 9
}) {
  const t = useMemo(() => getTheoreticalStats(), [])
  const sideBets = (activeSideBets ?? presetSideBets()).filter((d) => d.enabled)
  const sideRows = useMemo(
    () => sideBets.map((d) => ({ def: d, stats: sideBetStats(d) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(sideBets)],
  )
  const edgeTie = tiePayout === 9 ? t.edgeTie9 : t.edgeTie8

  const Row = ({ name, prob, edge, note }: { name: string; prob?: number; edge?: number; note?: string }) => (
    <tr className="border-b border-felt-800">
      <td className="py-2 pr-2 text-sm">{name}</td>
      <td className="num py-2 pr-2 text-right text-sm">{prob != null ? fmtPct(prob) : '—'}</td>
      <td className={`num py-2 text-right text-sm ${edge != null && edge > 0.05 ? 'text-banker' : ''}`}>
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
          <Row name="バンカー" prob={t.pBanker} edge={t.edgeBankerEZ} note="1:1(D7はプッシュ)" />
          <Row name="プレイヤー" prob={t.pPlayer} edge={t.edgePlayer} note="1:1" />
          <Row name={`タイ(${tiePayout}:1)`} prob={t.pTie} edge={edgeTie} note={`${tiePayout}:1`} />
          <Row name="ドラゴン7(参考)" prob={t.pDragon7} edge={t.edgeDragon7} note="40:1" />
          <Row name="パンダ8(参考)" prob={t.pPanda8} note="非提供" />
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

      <div className="space-y-2 rounded-lg bg-felt-950 p-3 text-[11px] leading-relaxed text-ink-2">
        <p>
          バカラの各ハンドは<b className="text-ink">独立試行</b>です。過去の出目は次のハンドに一切影響せず、
          控除率は常に固定です。次の結果を予測する方法は存在しません。
        </p>
        <p>
          期待値がマイナスのゲームでは賭け金の最適化は成立しません。推奨ベット額は
          <b className="text-ink">資金保全と時間管理のための基準</b>です。
        </p>
        <p className="text-banker">
          サイドベットの控除率は本線(バンカー約1.02%・プレイヤー約1.24%)より大幅に高い点に注意してください。
        </p>
      </div>
    </div>
  )
}
