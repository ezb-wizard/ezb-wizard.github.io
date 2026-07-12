import Dexie, { type Table } from 'dexie'
import { EZ_MAIN_BETS, type Hand, type RateInfo, type Session, type Settings } from '../types'

interface KV {
  key: string
  value: unknown
}

class EZBaccaratDB extends Dexie {
  sessions!: Table<Session, number>
  hands!: Table<Hand, number>
  kv!: Table<KV, string>

  constructor() {
    super('ez-baccarat')
    this.version(1).stores({
      sessions: '++id, startedAt, endedAt',
      hands: '++id, sessionId, [sessionId+seq], ts',
      kv: 'key',
    })
    // v2: カジノ対応。既存データは壊さず、追加フィールドを後方互換のデフォルトで補完する
    // (旧セッション = EZルール1:1+D7プッシュ+当時のタイ配当。保存済みnetは再計算しない)
    this.version(2)
      .stores({
        sessions: '++id, startedAt, endedAt',
        hands: '++id, sessionId, [sessionId+seq], ts',
        kv: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('sessions')
          .toCollection()
          .modify((s: Session) => {
            if (!s.mainBets) s.mainBets = { ...EZ_MAIN_BETS, tiePayout: s.tiePayout ?? 8 }
            if (s.casino === undefined) s.casino = null
            if (s.startInput === undefined) s.startInput = null
          })
        await tx
          .table('hands')
          .toCollection()
          .modify((h: Hand) => {
            if (h.loserTotal === undefined) h.loserTotal = null
            if (h.loserCards === undefined) h.loserCards = null
            if (h.pPair === undefined) h.pPair = null
            if (h.bPair === undefined) h.bPair = null
          })
      })
  }
}

export const db = new EZBaccaratDB()

export async function loadSettings(): Promise<Settings | null> {
  const row = await db.kv.get('settings')
  return (row?.value as Settings) ?? null
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.kv.put({ key: 'settings', value: s })
}

export async function loadCachedRate(): Promise<RateInfo | null> {
  const row = await db.kv.get('rate')
  return (row?.value as RateInfo) ?? null
}

export async function saveCachedRate(r: RateInfo): Promise<void> {
  await db.kv.put({ key: 'rate', value: r })
}
