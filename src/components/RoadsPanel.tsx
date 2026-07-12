import { useEffect, useMemo, useRef } from 'react'
import type { Hand, SideBetDef } from '../types'
import { buildBeadPlate, deriveRoad, layoutDerived, logicalStreaks, type DerivedMark } from '../lib/road'
import { getTheoreticalStats } from '../lib/baccarat'
import { fmtPct } from '../lib/money'
import BigRoad from './BigRoad'

const RED = '#e5484d'
const BLUE = '#4e97d6'
const TIE = '#35a366'
const GRID = '#2a3a52'

function ScrollGrid({
  cols,
  rows,
  cell,
  children,
  label,
}: {
  cols: number
  rows: number
  cell: number
  children: React.ReactNode
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = el.scrollWidth
  })
  const width = Math.max(cols, Math.ceil(240 / cell)) * cell
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-bold text-ink-3">{label}</div>
      <div ref={ref} className="overflow-x-auto rounded-lg border border-base-700 bg-base-950">
        <svg width={width} height={rows * cell} role="img" aria-label={label}>
          {Array.from({ length: Math.ceil(width / cell) + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * cell} y1={0} x2={i * cell} y2={rows * cell} stroke={GRID} strokeWidth={0.5} />
          ))}
          {Array.from({ length: rows + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * cell} x2={width} y2={i * cell} stroke={GRID} strokeWidth={0.5} />
          ))}
          {children}
        </svg>
      </div>
    </div>
  )
}

/** 珠盤路 */
function BeadPlate({ hands }: { hands: Hand[] }) {
  const cells = buildBeadPlate(hands)
  const CELL = 20
  const cols = cells.length ? cells[cells.length - 1].col + 1 : 0
  return (
    <ScrollGrid cols={cols} rows={6} cell={CELL} label="珠盤路">
      {cells.map((c, i) => {
        const color = c.winner === 'B' ? BLUE : c.winner === 'P' ? RED : TIE
        return (
          <g key={i}>
            <circle cx={c.col * CELL + CELL / 2} cy={c.row * CELL + CELL / 2} r={CELL / 2 - 2} fill={color} />
            <text
              x={c.col * CELL + CELL / 2}
              y={c.row * CELL + CELL / 2 + 3}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill="#fff"
            >
              {c.winner}
            </text>
          </g>
        )
      })}
    </ScrollGrid>
  )
}

/** 派生罫線(大眼仔路・小路・甲由路) */
function DerivedRoad({ marks, label, style }: { marks: DerivedMark[]; label: string; style: 'hollow' | 'solid' | 'slash' }) {
  const cells = useMemo(() => layoutDerived(marks), [marks])
  const CELL = 14
  const cols = cells.reduce((m, c) => Math.max(m, c.col + 1), 0)
  return (
    <ScrollGrid cols={cols} rows={6} cell={CELL} label={label}>
      {cells.map((c, i) => {
        const color = c.mark === 'R' ? RED : BLUE
        const cx = c.col * CELL + CELL / 2
        const cy = c.row * CELL + CELL / 2
        if (style === 'hollow')
          return <circle key={i} cx={cx} cy={cy} r={CELL / 2 - 2.5} fill="none" stroke={color} strokeWidth={1.8} />
        if (style === 'solid') return <circle key={i} cx={cx} cy={cy} r={CELL / 2 - 2.5} fill={color} />
        return (
          <line key={i} x1={cx - 4} y1={cy + 4} x2={cx + 4} y2={cy - 4} stroke={color} strokeWidth={2} strokeLinecap="round" />
        )
      })}
    </ScrollGrid>
  )
}

/**
 * 次のハンドの確率表示。
 * 理論値は常に一定(独立試行)であり、過去の出目・実績から次の結果は予測できない。
 * 実績は「理論値への収束を確認する」ための参考値としてのみ併記する。
 */
export function ProbPanel({ hands }: { hands: Hand[] }) {
  const t = getTheoreticalStats()
  const n = hands.length
  const obs = (w: 'B' | 'P' | 'T') => (n > 0 ? hands.filter((h) => h.winner === w).length / n : null)
  const Row = ({ name, color, theory, actual }: { name: string; color: string; theory: number; actual: number | null }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-20 font-bold ${color}`}>{name}</span>
      <span className="num flex-1 text-right text-lg font-bold">{fmtPct(theory)}</span>
      <span className="num w-24 text-right text-xs text-ink-3">
        実績 {actual != null ? fmtPct(actual, 1) : '—'}
      </span>
    </div>
  )
  return (
    <div className="card-luxe space-y-1.5 p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-bold text-gold-300">次のハンドの確率(理論値・8デッキ)</h3>
        <span className="num text-[10px] text-ink-3">{n}ハンド記録</span>
      </div>
      <Row name="バンカー" color="text-banker" theory={t.pBanker} actual={obs('B')} />
      <Row name="プレイヤー" color="text-player" theory={t.pPlayer} actual={obs('P')} />
      <Row name="タイ" color="text-tie" theory={t.pTie} actual={obs('T')} />
      <p className="text-[10px] leading-relaxed text-ink-3">
        ※ この確率は<b className="text-ink">常に一定</b>です。各ハンドは独立試行のため、罫線・過去の出目・実績から
        次の結果を予測することはできません(実績は理論値への収束確認用の参考値です)。
      </p>
    </div>
  )
}

/** 罫線一式(大路・珠盤路・大眼仔路・小路・甲由路) */
export default function RoadsPanel({ hands, sideBets }: { hands: Hand[]; sideBets: SideBetDef[] }) {
  const streaks = useMemo(() => logicalStreaks(hands), [hands])
  const bigEye = useMemo(() => deriveRoad(streaks, 1), [streaks])
  const small = useMemo(() => deriveRoad(streaks, 2), [streaks])
  const roach = useMemo(() => deriveRoad(streaks, 3), [streaks])
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-0.5 text-[10px] font-bold text-ink-3">大路</div>
        <BigRoad hands={hands} sideBets={sideBets} />
      </div>
      <BeadPlate hands={hands} />
      <DerivedRoad marks={bigEye} label="大眼仔路" style="hollow" />
      <DerivedRoad marks={small} label="小路" style="solid" />
      <DerivedRoad marks={roach} label="甲由路" style="slash" />
      <p className="text-[10px] leading-relaxed text-ink-3">
        派生罫線(大眼仔路・小路・甲由路)は出目の「規則性(赤)/不規則性(青)」を可視化する伝統的な記録表です。
        いずれも次のハンドの結果とは無関係です(独立試行)。
      </p>
    </div>
  )
}
