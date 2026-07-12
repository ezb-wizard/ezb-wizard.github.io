import Dexie, { type Table } from 'dexie'
import type { Hand, RateInfo, Session, Settings } from '../types'

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
