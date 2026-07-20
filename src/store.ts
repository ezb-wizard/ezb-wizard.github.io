import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  sessionRules,
  type BetPlacement,
  type Checkpoint,
  type Hand,
  type HandInput,
  type RateInfo,
  type Session,
  type Settings,
  type Winner,
} from './types'
import { db, loadCachedRate, loadSettings, saveCachedRate, saveSettings } from './lib/db'
import { fetchRateFromApis } from './lib/rates'
import { settleHand, type SettleContext } from './lib/settle'

export type Screen = 'play' | 'stats' | 'sim' | 'settings'

interface AppState {
  ready: boolean
  settings: Settings
  rate: RateInfo | null
  session: Session | null
  hands: Hand[]
  /** 現在セッションの資金チェックポイント(ts昇順) */
  checkpoints: Checkpoint[]
  /** 現在のシュー番号(1始まり) */
  shoe: number
  screen: Screen
  theoryOpen: boolean
  /** 直近終了セッション(サマリーモーダル表示用) */
  lastSummary: Session | null
  clearSummary(): void

  init(): Promise<void>
  setScreen(s: Screen): void
  setTheoryOpen(open: boolean): void
  refreshRate(): Promise<void>
  updateSettings(patch: Partial<Settings>): Promise<void>

  startSession(cfg: Omit<Session, 'id' | 'startedAt' | 'endedAt' | 'endKrw' | 'handCount'>): Promise<void>
  /** endKrwOverride: 結果のみ記録モードで終了資金を手入力した場合の上書き値 */
  endSession(endKrwOverride?: number): Promise<Session>
  addHand(input: HandInput, bets: BetPlacement[]): Promise<void>
  /** 途中参加時などに過去の出目を「見」としてまとめて登録 */
  addHandsBulk(winners: Winner[]): Promise<void>
  /** シュー切替(罫線・シュー内統計をリセット。記録は保持) */
  nextShoe(): void
  addCheckpoint(krw: number, ts?: number): Promise<void>
  deleteCheckpoint(id: number): Promise<void>
  undoLast(): Promise<void>
  updateHand(id: number, input: HandInput, bets: BetPlacement[]): Promise<void>
  deleteHand(id: number): Promise<void>
  /** 確定(終了)済みセッションをハンドごと削除 */
  deleteSession(id: number): Promise<void>
}

function settleCtx(session: Session): SettleContext {
  return { mainBets: sessionRules(session), sideBets: session.sideBets }
}

/** 現在資金 = 開始資金 + 全ハンド純損益 */
export function bankrollOf(session: Session, hands: Hand[]): number {
  return session.startKrw + hands.reduce((s, h) => s + h.net, 0)
}

let rateTimer: ReturnType<typeof setInterval> | null = null

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  rate: null,
  session: null,
  hands: [],
  checkpoints: [],
  shoe: 1,
  screen: 'play',
  theoryOpen: false,
  lastSummary: null,

  clearSummary() {
    set({ lastSummary: null })
  },

  async init() {
    // 保存済み設定に無い新フィールドはデフォルトで補完
    const settings: Settings = { ...DEFAULT_SETTINGS, ...((await loadSettings()) ?? {}) }
    const cached = await loadCachedRate()
    // 進行中セッション(endedAt が null)を復元
    const open = await db.sessions.filter((s) => s.endedAt === null).last()
    const hands = open?.id != null ? await db.hands.where('sessionId').equals(open.id).sortBy('seq') : []
    const checkpoints =
      open?.id != null ? await db.checkpoints.where('sessionId').equals(open.id).sortBy('ts') : []
    set({
      settings,
      rate: cached ? { ...cached, source: settings.manualRateFixed ? cached.source : 'cache' } : null,
      session: open ?? null,
      hands,
      checkpoints,
      shoe: hands.reduce((m, h) => Math.max(m, h.shoe ?? 1), 1),
      ready: true,
    })
    void get().refreshRate()
    // オンライン時:起動時+1時間ごとに自動更新
    if (rateTimer) clearInterval(rateTimer)
    rateTimer = setInterval(() => void get().refreshRate(), 60 * 60 * 1000)
  },

  setScreen(screen) {
    set({ screen })
  },

  setTheoryOpen(theoryOpen) {
    set({ theoryOpen })
  },

  async refreshRate() {
    const { settings } = get()
    // 手動レート固定時は自動更新しない
    if (settings.manualRateFixed && settings.manualRate) {
      set({ rate: { rate: settings.manualRate, ts: settings.manualRateTs ?? Date.now(), source: 'manual' } })
      return
    }
    if (!navigator.onLine) return
    try {
      const { rate, ts } = await fetchRateFromApis()
      const info: RateInfo = { rate, ts, source: 'api' }
      set({ rate: info })
      await saveCachedRate(info)
    } catch {
      // フォールバック:既存キャッシュ(state維持)→ 手動入力(設定画面)
      const { rate, settings: s } = get()
      if (!rate && s.manualRate) {
        set({ rate: { rate: s.manualRate, ts: s.manualRateTs ?? Date.now(), source: 'manual' } })
      }
    }
  },

  async updateSettings(patch) {
    const settings = { ...get().settings, ...patch }
    set({ settings })
    await saveSettings(settings)
    if ('manualRate' in patch || 'manualRateFixed' in patch) {
      if (settings.manualRateFixed && settings.manualRate) {
        const info: RateInfo = { rate: settings.manualRate, ts: settings.manualRateTs ?? Date.now(), source: 'manual' }
        set({ rate: info })
        await saveCachedRate(info)
      } else {
        void get().refreshRate()
      }
    }
  },

  async startSession(cfg) {
    const session: Session = { ...cfg, startedAt: Date.now(), endedAt: null, endKrw: null, handCount: null }
    const id = await db.sessions.add(session)
    // 開始資金を最初のチェックポイントとして記録
    const cp: Checkpoint = { sessionId: id, ts: session.startedAt, krw: session.startKrw }
    const cpId = await db.checkpoints.add(cp)
    set({ session: { ...session, id }, hands: [], checkpoints: [{ ...cp, id: cpId }], shoe: 1, screen: 'play' })
  },

  async endSession(endKrwOverride) {
    const { session, hands } = get()
    if (!session?.id) throw new Error('セッションがありません')
    const done: Session = {
      ...session,
      endedAt: Date.now(),
      endKrw: endKrwOverride ?? bankrollOf(session, hands),
      handCount: hands.length,
    }
    await db.sessions.put(done)
    set({ session: null, hands: [], checkpoints: [], shoe: 1, lastSummary: done })
    return done
  },

  async addHand(input, bets) {
    const { session, hands } = get()
    if (!session?.id) throw new Error('セッションがありません')
    const hand: Hand = {
      ...input,
      sessionId: session.id,
      seq: hands.length ? hands[hands.length - 1].seq + 1 : 1,
      ts: Date.now(),
      shoe: get().shoe,
      bets,
      net: settleHand(bets, input, settleCtx(session)),
    }
    const id = await db.hands.add(hand)
    set({ hands: [...hands, { ...hand, id }] })
  },

  async addHandsBulk(winners) {
    const { session, hands } = get()
    if (!session?.id) throw new Error('セッションがありません')
    let seq = hands.length ? hands[hands.length - 1].seq : 0
    const ts = Date.now()
    const newHands: Hand[] = winners.map((w) => ({
      winner: w,
      winnerTotal: null,
      winnerCards: null,
      loserTotal: null,
      loserCards: null,
      pPair: null,
      bPair: null,
      sessionId: session.id!,
      seq: ++seq,
      ts,
      shoe: get().shoe,
      bets: [],
      net: 0,
    }))
    const ids = (await db.hands.bulkAdd(newHands, { allKeys: true })) as number[]
    set({ hands: [...hands, ...newHands.map((h, i) => ({ ...h, id: ids[i] }))] })
  },

  nextShoe() {
    set({ shoe: get().shoe + 1 })
  },

  async addCheckpoint(krw, ts) {
    const { session, checkpoints } = get()
    if (!session?.id) throw new Error('セッションがありません')
    const cp: Checkpoint = { sessionId: session.id, ts: ts ?? Date.now(), krw }
    const id = await db.checkpoints.add(cp)
    set({ checkpoints: [...checkpoints, { ...cp, id }].sort((a, b) => a.ts - b.ts) })
  },

  async deleteCheckpoint(id) {
    const { checkpoints } = get()
    await db.checkpoints.delete(id)
    set({ checkpoints: checkpoints.filter((c) => c.id !== id) })
  },

  async undoLast() {
    const { hands } = get()
    const last = hands[hands.length - 1]
    if (!last?.id) return
    await db.hands.delete(last.id)
    set({ hands: hands.slice(0, -1) })
  },

  async updateHand(id, input, bets) {
    const { session, hands } = get()
    if (!session) return
    const idx = hands.findIndex((h) => h.id === id)
    if (idx < 0) return
    const updated: Hand = { ...hands[idx], ...input, bets, net: settleHand(bets, input, settleCtx(session)) }
    await db.hands.put(updated)
    const next = hands.slice()
    next[idx] = updated
    set({ hands: next })
  },

  async deleteHand(id) {
    const { hands } = get()
    await db.hands.delete(id)
    set({ hands: hands.filter((h) => h.id !== id) })
  },

  async deleteSession(id) {
    const { session } = get()
    if (session?.id === id) throw new Error('進行中のセッションは削除できません')
    await db.hands.where('sessionId').equals(id).delete()
    await db.checkpoints.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  },
}))

/** 最新チェックポイント残高(結果のみ記録モードでの現在資金) */
export function latestCheckpointKrw(checkpoints: Checkpoint[], fallback: number): number {
  return checkpoints.length ? checkpoints[checkpoints.length - 1].krw : fallback
}
