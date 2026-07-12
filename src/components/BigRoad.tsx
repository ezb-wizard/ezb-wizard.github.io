import { useEffect, useRef } from 'react'
import type { Hand, SideBetDef } from '../types'
import { buildBigRoad } from '../lib/road'

const CELL = 26
const ROWS = 6

/** 大路(ビッグロード)。サイドベット成立ハンドはマーク付き */
export default function BigRoad({ hands, sideBets }: { hands: Hand[]; sideBets: SideBetDef[] }) {
  const { cells, cols } = buildBigRoad(hands, sideBets)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 最新列へ自動スクロール
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [cells.length])

  const width = Math.max(cols, 10) * CELL

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto rounded-lg border border-base-700 bg-base-950">
        <svg width={width} height={ROWS * CELL} role="img" aria-label="大路">
          {/* グリッド(控えめ) */}
          {Array.from({ length: Math.max(cols, 10) + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={ROWS * CELL} stroke="#2a3a52" strokeWidth={0.5} />
          ))}
          {Array.from({ length: ROWS + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * CELL} x2={width} y2={i * CELL} stroke="#2a3a52" strokeWidth={0.5} />
          ))}
          {cells.map((c, i) => {
            const cx = c.col * CELL + CELL / 2
            const cy = c.row * CELL + CELL / 2
            const color = c.winner === 'B' ? '#4e97d6' : '#e5484d'
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={CELL / 2 - 4} fill="none" stroke={color} strokeWidth={2.5} />
                <text
                  x={cx}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill={color}
                >
                  {c.winner}
                </text>
                {c.ties > 0 && (
                  <g>
                    <line x1={cx - 7} y1={cy + 7} x2={cx + 7} y2={cy - 7} stroke="#35a366" strokeWidth={2} />
                    {c.ties > 1 && (
                      <text x={cx + 8} y={cy - 6} fontSize={8} fontWeight={700} fill="#35a366">
                        {c.ties}
                      </text>
                    )}
                  </g>
                )}
                {c.d7 && <circle cx={cx + 7} cy={cy + 7} r={3.5} fill="#b58c3c" />}
                {!c.d7 && c.marks.length > 0 && (
                  <rect x={cx + 4} y={cy + 4} width={6} height={6} fill="#b58c3c" transform={`rotate(45 ${cx + 7} ${cy + 7})`} />
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-3">
        <span><span className="font-bold text-banker">○B</span> バンカー</span>
        <span><span className="font-bold text-player">○P</span> プレイヤー</span>
        <span><span className="font-bold text-tie">/</span> タイ</span>
        <span><span className="text-[#b58c3c]">●</span> ドラゴン7</span>
        <span><span className="text-[#b58c3c]">◆</span> サイドベット成立</span>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
        ※ 過去の出目は次のハンドに影響しません(各ハンドは独立試行)。この表は記録の確認用です。
      </p>
    </div>
  )
}
