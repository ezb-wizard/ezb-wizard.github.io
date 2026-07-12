import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useApp } from '../store'
import { sessionRules, type Hand, type Session } from '../types'
import { getTheoreticalStats } from '../lib/baccarat'
import { sideBetStats } from '../lib/sidebets'
import { matchRule, possibleMatch, settleBet } from '../lib/settle'
import { fmtJpy, fmtKrw, fmtPct, fmtSigned, krwToJpy } from '../lib/money'
import { LineChart } from './charts'
import BigRoad from './BigRoad'
import { Seg } from './ui'

export default function StatsScreen() {
  const { session: liveSession, rate } = useApp()
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), []) ?? []
  const [selRaw, setSelRaw] = useState<number | 'all' | null>(null)

  const sel: number | 'all' | null = selRaw ?? liveSession?.id ?? sessions[0]?.id ?? null
  const selSession: Session | null =
    sel === 'all' || sel == null ? null : (sessions.find((s) => s.id === sel) ?? liveSession ?? null)

  const hands =
    useLiveQuery(async () => {
      if (sel == null) return [] as Hand[]
      if (sel === 'all') {
        const all = await db.hands.toArray()
        return all.sort((a, b) => a.ts - b.ts || a.seq - b.seq)
      }
      return db.hands.where('sessionId').equals(sel).sortBy('seq')
    }, [sel]) ?? []

  const sessionById = useMemo(() => {
    const m = new Map<number, Session>()
    for (const s of sessions) if (s.id != null) m.set(s.id, s)
    return m
  }, [sessions])

  const config = selSession ?? liveSession ?? sessions[0] ?? null
  const curRate = rate?.rate ?? config?.rate ?? null

  if (sessions.length === 0) {
    return <p className="p-8 text-center text-sm text-ink-3">まだセッションの記録がありません</p>
  }

  return (
    <div className="space-y-4 p-3 pb-8">
      {/* 対象選択 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <ScopeChip label="全期間" active={sel === 'all'} onClick={() => setSelRaw('all')} />
        {sessions.map((s) => (
          <ScopeChip
            key={s.id}
            label={s.endedAt == null ? '進行中' : new Date(s.startedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
            active={sel === s.id}
            onClick={() => setSelRaw(s.id!)}
          />
        ))}
      </div>

      <SummaryCards hands={hands} sessionById={sessionById} sel={sel} curRate={curRate} />

      <Section title="ベット別成績">
        <PerTargetTable hands={hands} sessionById={sessionById} />
      </Section>

      {selSession && (
        <>
          <Section title="資金推移">
            <BankrollSection session={selSession} hands={hands} curRate={curRate} />
          </Section>
          <Section title="出目履歴(大路)">
            <BigRoad hands={hands} sideBets={selSession.sideBets} />
          </Section>
        </>
      )}
      {sel === 'all' && (
        <p className="text-[10px] text-ink-3">※ 資金推移・大路はセッションを選択すると表示されます</p>
      )}

      <Section title="実績 vs 理論値">
        <TheoryComparison hands={hands} config={config} />
      </Section>

      <Section title="セッション一覧">
        <div className="card-luxe divide-y divide-base-800 overflow-hidden">
          {sessions.map((s) => {
            const pl = s.endKrw != null ? s.endKrw - s.startKrw : null
            return (
              <button
                key={s.id}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left ${sel === s.id ? 'bg-base-800' : ''}`}
                onClick={() => setSelRaw(s.id!)}
              >
                <div className="flex-1">
                  <div className="text-xs font-bold">
                    {new Date(s.startedAt).toLocaleDateString('ja-JP')}{' '}
                    {s.endedAt == null && <span className="text-gold-300">進行中</span>}
                  </div>
                  <div className="num text-[10px] text-ink-3">
                    {s.handCount ?? '—'}ハンド / 開始{fmtKrw(s.startKrw)}
                  </div>
                </div>
                <span className={`num text-sm font-bold ${pl == null ? 'text-ink-3' : pl > 0 ? 'text-win' : pl < 0 ? 'text-lose' : ''}`}>
                  {pl == null ? '—' : fmtSigned(pl)}
                </span>
              </button>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

function ScopeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`h-10 shrink-0 rounded-full border px-4 text-xs font-bold ${
        active ? 'border-gold-500 bg-gold-500 text-base-950' : 'border-base-700 bg-base-900 text-ink-2'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-luxe p-3">
      <h2 className="mb-2 text-xs font-bold text-gold-300">{title}</h2>
      {children}
    </section>
  )
}

function SummaryCards({
  hands,
  sessionById,
  sel,
  curRate,
}: {
  hands: Hand[]
  sessionById: Map<number, Session>
  sel: number | 'all' | null
  curRate: number | null
}) {
  const net = hands.reduce((s, h) => s + h.net, 0)
  const betHands = hands.filter((h) => h.bets.length > 0)
  const avgBet =
    betHands.length === 0
      ? 0
      : betHands.reduce((s, h) => s + h.bets.reduce((x, b) => x + b.amount, 0), 0) / betHands.length

  // 最大ドローダウン(セッション内で計算し、全期間は最大値)
  const maxDD = useMemo(() => {
    const byId = new Map<number, Hand[]>()
    for (const h of hands) {
      const arr = byId.get(h.sessionId) ?? []
      arr.push(h)
      byId.set(h.sessionId, arr)
    }
    let worst = 0
    for (const [sid, hs] of byId) {
      const start = sessionById.get(sid)?.startKrw ?? 0
      let cur = start
      let peak = start
      for (const h of hs) {
        cur += h.net
        peak = Math.max(peak, cur)
        worst = Math.max(worst, peak - cur)
      }
    }
    return worst
  }, [hands, sessionById])

  const jpy = krwToJpy(net, curRate)
  return (
    <div className="grid grid-cols-2 gap-2">
      <Card label={sel === 'all' ? '総収支' : 'セッション収支'}>
        <span className={`num text-lg font-bold ${net > 0 ? 'text-win' : net < 0 ? 'text-lose' : ''}`}>
          {fmtSigned(net)}
        </span>
        <span className="num block text-[10px] text-ink-2">
          {jpy != null ? `約${jpy >= 0 ? '+' : ''}${fmtJpy(jpy)}` : ''}
        </span>
      </Card>
      <Card label="ハンド数(うちベット)">
        <span className="num text-lg font-bold">
          {hands.length}
          <span className="text-xs text-ink-2">({betHands.length})</span>
        </span>
      </Card>
      <Card label="平均ベット額">
        <span className="num text-lg font-bold">{fmtKrw(avgBet)}</span>
      </Card>
      <Card label="最大ドローダウン">
        <span className="num text-lg font-bold text-lose">{maxDD > 0 ? `-${fmtKrw(maxDD)}` : '—'}</span>
      </Card>
    </div>
  )
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card-luxe p-2.5">
      <div className="text-[10px] text-ink-3">{label}</div>
      {children}
    </div>
  )
}

/** B/P/T・各サイドベット別の勝率・収支(ベット単位で精算し直して集計) */
function PerTargetTable({ hands, sessionById }: { hands: Hand[]; sessionById: Map<number, Session> }) {
  const rows = useMemo(() => {
    const acc = new Map<string, { name: string; n: number; win: number; push: number; lose: number; net: number }>()
    for (const h of hands) {
      const s = sessionById.get(h.sessionId)
      if (!s) continue
      const ctx = { mainBets: sessionRules(s), sideBets: s.sideBets }
      for (const b of h.bets) {
        if (b.amount <= 0) continue
        let net: number
        try {
          net = settleBet(b, h, ctx)
        } catch {
          continue
        }
        const name =
          b.target === 'B'
            ? 'バンカー'
            : b.target === 'P'
              ? 'プレイヤー'
              : b.target === 'T'
                ? 'タイ'
                : (s.sideBets.find((d) => d.id === b.target)?.name ?? b.target)
        const r = acc.get(b.target) ?? { name, n: 0, win: 0, push: 0, lose: 0, net: 0 }
        r.n++
        r.net += net
        if (net > 0) r.win++
        else if (net === 0) r.push++
        else r.lose++
        acc.set(b.target, r)
      }
    }
    return [...acc.values()]
  }, [hands, sessionById])

  if (rows.length === 0) return <p className="text-xs text-ink-3">ベットの記録がまだありません</p>

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] text-ink-3">
          <th className="py-1 font-normal">対象</th>
          <th className="py-1 text-right font-normal">回数</th>
          <th className="py-1 text-right font-normal">勝-分-敗</th>
          <th className="py-1 text-right font-normal">勝率</th>
          <th className="py-1 text-right font-normal">収支</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-t border-base-800">
            <td className="py-1.5">{r.name}</td>
            <td className="num py-1.5 text-right">{r.n}</td>
            <td className="num py-1.5 text-right">
              {r.win}-{r.push}-{r.lose}
            </td>
            <td className="num py-1.5 text-right">
              {r.n - r.push > 0 ? fmtPct(r.win / (r.n - r.push), 1) : '—'}
            </td>
            <td className={`num py-1.5 text-right font-bold ${r.net > 0 ? 'text-win' : r.net < 0 ? 'text-lose' : ''}`}>
              {fmtSigned(r.net)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BankrollSection({
  session,
  hands,
  curRate,
}: {
  session: Session
  hands: Hand[]
  curRate: number | null
}) {
  const [ccy, setCcy] = useState<'krw' | 'jpy'>('krw')
  const rate = session.rate ?? curRate
  const points = useMemo(() => {
    let cur = session.startKrw
    const pts = [{ x: 0, y: cur }]
    hands.forEach((h, i) => {
      cur += h.net
      pts.push({ x: i + 1, y: cur })
    })
    return pts
  }, [session, hands])

  const conv = (v: number) => (ccy === 'jpy' && rate ? v / rate : v)
  const fmt = ccy === 'jpy' && rate ? (v: number) => fmtJpy(v) : (v: number) => fmtKrw(v)

  const refLines = [
    { y: conv(session.startKrw), label: '開始', color: '#93a1b3' },
    ...(session.stopLossKrw != null ? [{ y: conv(session.stopLossKrw), label: 'SL', color: '#e5484d' }] : []),
    ...(session.takeProfitKrw != null ? [{ y: conv(session.takeProfitKrw), label: 'TP', color: '#2ecc8f' }] : []),
  ]

  return (
    <div>
      {rate != null && (
        <Seg
          className="mb-2 !h-9"
          options={[
            { value: 'krw', label: '₩' },
            { value: 'jpy', label: '¥' },
          ]}
          value={ccy}
          onChange={setCcy}
        />
      )}
      <LineChart
        points={points.map((p) => ({ x: p.x, y: conv(p.y) }))}
        yFmt={fmt}
        xFmt={(x) => (x === 0 ? '開始' : `#${x}ハンド`)}
        refLines={refLines}
      />
    </div>
  )
}

/** 実績と理論値の乖離+収束チャート */
function TheoryComparison({ hands, config }: { hands: Hand[]; config: Session | null }) {
  const t = getTheoreticalStats()
  const sideDefs = (config?.sideBets ?? []).filter((d) => d.enabled)

  // 'hit'=成立 / 'miss'=不成立確定 / 'unknown'=入力省略により判定不能(集計から除外)
  const metrics = useMemo(
    () => [
      { id: 'B', name: 'バンカー', theory: t.pBanker, test: (h: Hand) => (h.winner === 'B' ? 'hit' : 'miss') },
      { id: 'P', name: 'プレイヤー', theory: t.pPlayer, test: (h: Hand) => (h.winner === 'P' ? 'hit' : 'miss') },
      { id: 'T', name: 'タイ', theory: t.pTie, test: (h: Hand) => (h.winner === 'T' ? 'hit' : 'miss') },
      ...sideDefs.map((d) => ({
        id: d.id,
        name: d.name,
        theory: sideBetStats(d).winProb,
        test: (h: Hand) => (matchRule(d, h) != null ? 'hit' : possibleMatch(d, h) ? 'unknown' : 'miss'),
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(sideDefs)],
  )

  const [metricId, setMetricId] = useState('B')
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0]

  const convergence = useMemo(() => {
    if (hands.length === 0) return []
    const step = Math.max(1, Math.ceil(hands.length / 300))
    const pts: { x: number; y: number }[] = []
    let hits = 0
    let decidable = 0
    hands.forEach((h, i) => {
      const r = metric.test(h)
      if (r !== 'unknown') decidable++
      if (r === 'hit') hits++
      if (((i + 1) % step === 0 || i === hands.length - 1) && decidable > 0)
        pts.push({ x: i + 1, y: (hits / decidable) * 100 })
    })
    return pts
  }, [hands, metric])

  return (
    <div className="space-y-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] text-ink-3">
            <th className="py-1 font-normal">対象</th>
            <th className="py-1 text-right font-normal">実績</th>
            <th className="py-1 text-right font-normal">理論</th>
            <th className="py-1 text-right font-normal">乖離</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const results = hands.map(m.test)
            const hits = results.filter((r) => r === 'hit').length
            const decidable = results.filter((r) => r !== 'unknown').length
            const obs = decidable > 0 ? hits / decidable : null
            const dev = obs != null ? obs - m.theory : null
            return (
              <tr key={m.id} className="border-t border-base-800">
                <td className="py-1.5">{m.name}</td>
                <td className="num py-1.5 text-right">
                  {obs != null ? `${fmtPct(obs)} (${hits})` : '—'}
                </td>
                <td className="num py-1.5 text-right text-ink-2">{fmtPct(m.theory)}</td>
                <td className={`num py-1.5 text-right ${dev != null && Math.abs(dev) > 0.02 ? 'text-gold-300' : 'text-ink-3'}`}>
                  {dev != null ? `${dev >= 0 ? '+' : ''}${(dev * 100).toFixed(2)}pt` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div>
        <div className="mb-1 flex gap-1.5 overflow-x-auto">
          {metrics.map((m) => (
            <button
              key={m.id}
              className={`h-9 shrink-0 rounded-full border px-3 text-[11px] font-bold ${
                metric.id === m.id ? 'border-gold-500 bg-gold-500 text-base-950' : 'border-base-700 text-ink-2'
              }`}
              onClick={() => setMetricId(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
        <LineChart
          points={convergence}
          yFmt={(y) => `${y.toFixed(2)}%`}
          xFmt={(x) => `${x}ハンド時点`}
          refLines={[{ y: metric.theory * 100, label: `理論 ${fmtPct(metric.theory)}` }]}
          height={150}
        />
        <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
          試行回数が増えるほど実績は理論値に収束します。乖離は偶然の揺らぎであり、次のハンドの予測には使えません(独立試行)。
          サイドベットの実績は、入力を省略して判定できないハンドを除いて集計しています。
        </p>
      </div>
    </div>
  )
}
