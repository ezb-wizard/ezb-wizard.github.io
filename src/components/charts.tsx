import { useMemo, useRef, useState } from 'react'

export interface Pt {
  x: number
  y: number
}

export interface RefLine {
  y: number
  label: string
  color?: string
}

const INK3 = '#78838f'
const GRID = '#2a3a52'

/** 単一系列の折れ線(タッチでクロスヘア+ツールチップ) */
export function LineChart({
  points,
  yFmt,
  xFmt = (x) => `#${x}`,
  refLines = [],
  height = 180,
  color = '#d4b45a',
}: {
  points: Pt[]
  yFmt: (y: number) => string
  xFmt?: (x: number) => string
  refLines?: RefLine[]
  height?: number
  color?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 360
  const H = height
  const PAD = { l: 6, r: 6, t: 14, b: 6 }

  const { path, sx, sy, yMin, yMax } = useMemo(() => {
    const xs = points.map((p) => p.x)
    const ys = [...points.map((p) => p.y), ...refLines.map((r) => r.y)]
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    let yMin = Math.min(...ys)
    let yMax = Math.max(...ys)
    if (yMin === yMax) {
      yMin -= 1
      yMax += 1
    }
    const yPad = (yMax - yMin) * 0.08
    yMin -= yPad
    yMax += yPad
    const sx = (x: number) => PAD.l + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (W - PAD.l - PAD.r)
    const sy = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
    return { path, sx, sy, yMin, yMax }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, refLines, H])

  if (points.length < 2) {
    return <p className="py-6 text-center text-xs text-ink-3">データがまだ足りません</p>
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestD = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - px)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    setHover(best)
  }

  const hp = hover != null ? points[hover] : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-pan-y select-none"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {/* 控えめな水平グリッド + 目盛 */}
      {[0.25, 0.5, 0.75].map((f) => {
        const y = PAD.t + f * (H - PAD.t - PAD.b)
        return <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={GRID} strokeWidth={0.5} />
      })}
      <text x={PAD.l + 2} y={PAD.t - 4} fontSize={9} fill={INK3}>
        {yFmt(yMax)}
      </text>
      <text x={PAD.l + 2} y={H - PAD.b - 3} fontSize={9} fill={INK3}>
        {yFmt(yMin)}
      </text>

      {refLines.map((r) => (
        <g key={r.label}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={sy(r.y)}
            y2={sy(r.y)}
            stroke={r.color ?? '#9db4aa'}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text x={W - PAD.r - 2} y={sy(r.y) - 4} fontSize={9} fill={r.color ?? '#9db4aa'} textAnchor="end">
            {r.label}
          </text>
        </g>
      ))}

      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />

      {hp && (
        <g>
          <line x1={sx(hp.x)} x2={sx(hp.x)} y1={PAD.t} y2={H - PAD.b} stroke={INK3} strokeWidth={1} />
          <circle cx={sx(hp.x)} cy={sy(hp.y)} r={4.5} fill={color} stroke="#0b0f14" strokeWidth={2} />
          <Tooltip x={sx(hp.x)} y={PAD.t + 4} w={W} lines={[xFmt(hp.x), yFmt(hp.y)]} />
        </g>
      )}
    </svg>
  )
}

function Tooltip({ x, y, w, lines }: { x: number; y: number; w: number; lines: string[] }) {
  const bw = Math.max(...lines.map((l) => l.length)) * 6.4 + 14
  const bx = Math.min(Math.max(x + 8, 2), w - bw - 2)
  return (
    <g>
      <rect x={bx} y={y} width={bw} height={14 + lines.length * 13} rx={4} fill="#0b0f14" stroke={GRID} />
      {lines.map((l, i) => (
        <text key={i} x={bx + 7} y={y + 15 + i * 13} fontSize={10} fill="#f2efe6">
          {l}
        </text>
      ))}
    </g>
  )
}

export interface Hist {
  min: number
  max: number
  binWidth: number
  bins: number[]
}

/** ヒストグラム(タップでレンジ+件数) */
export function HistChart({
  hist,
  xFmt,
  height = 150,
}: {
  hist: Hist
  xFmt: (v: number) => string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 360
  const H = height
  const PAD = { l: 6, r: 6, t: 14, b: 6 }
  const maxBin = Math.max(...hist.bins, 1)
  const bw = (W - PAD.l - PAD.r) / hist.bins.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y select-none" onPointerLeave={() => setHover(null)}>
      {[0.5].map((f) => {
        const y = PAD.t + f * (H - PAD.t - PAD.b)
        return <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={GRID} strokeWidth={0.5} />
      })}
      {hist.bins.map((n, i) => {
        const h = (n / maxBin) * (H - PAD.t - PAD.b)
        return (
          <rect
            key={i}
            x={PAD.l + i * bw + 1}
            y={H - PAD.b - h}
            width={Math.max(1, bw - 2)}
            height={h}
            rx={2}
            fill={hover === i ? '#f2d98d' : '#b58c3c'}
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          />
        )
      })}
      <text x={PAD.l + 2} y={H - PAD.b - 3} fontSize={9} fill={INK3}>
        {xFmt(hist.min)}
      </text>
      <text x={W - PAD.r - 2} y={H - PAD.b - 3} fontSize={9} fill={INK3} textAnchor="end">
        {xFmt(hist.max)}
      </text>
      {hover != null && (
        <Tooltip
          x={PAD.l + hover * bw}
          y={PAD.t}
          w={W}
          lines={[
            `${xFmt(hist.min + hover * hist.binWidth)}〜${xFmt(hist.min + (hover + 1) * hist.binWidth)}`,
            `${hist.bins[hover].toLocaleString()}回`,
          ]}
        />
      )}
    </svg>
  )
}
