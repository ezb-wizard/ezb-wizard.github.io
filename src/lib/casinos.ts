import type { CasinoConfig, CasinoId, Settings, SideBetDef } from '../types'

export const CASINO_NAMES: Record<CasinoId, string> = {
  PARADISE: 'PARADISE 仁川',
  INSPIRE: 'INSPIRE 仁川',
}

/** Small/Big Dragon・Tiger(両カジノ共通の的中条件) */
function dragonTigerFamily(): SideBetDef[] {
  return [
    {
      id: 'SMALL_DRAGON',
      name: 'スモールドラゴン',
      side: 'P',
      rules: [{ totals: [7], cards: '2', payout: 15 }],
      enabled: true,
      preset: true,
    },
    {
      id: 'BIG_DRAGON',
      name: 'ビッグドラゴン',
      side: 'P',
      rules: [{ totals: [7], cards: '3', payout: 30 }],
      enabled: true,
      preset: true,
    },
    {
      id: 'SMALL_TIGER',
      name: 'スモールタイガー',
      side: 'B',
      rules: [{ totals: [6], cards: '2', payout: 22 }],
      enabled: true,
      preset: true,
    },
    {
      id: 'BIG_TIGER',
      name: 'ビッグタイガー',
      side: 'B',
      rules: [{ totals: [6], cards: '3', payout: 50 }],
      enabled: true,
      preset: true,
    },
  ]
}

function pairBets(): SideBetDef[] {
  return [
    {
      id: 'P_PAIR',
      name: 'プレイヤーペア',
      side: 'P',
      pairTarget: 'P',
      rules: [{ totals: [], cards: 'any', payout: 11 }],
      enabled: true,
      preset: true,
    },
    {
      id: 'B_PAIR',
      name: 'バンカーペア',
      side: 'B',
      pairTarget: 'B',
      rules: [{ totals: [], cards: 'any', payout: 11 }],
      enabled: true,
      preset: true,
    },
  ]
}

/** カジノごとのデフォルト配当プリセット */
export function casinoPreset(id: CasinoId): CasinoConfig {
  if (id === 'INSPIRE') {
    return {
      // Banker 0.95:1(コミッション式)デフォルト。EZノーコミッションへ切替可
      mainBets: { playerPayout: 1, bankerPayout: 0.95, bankerRule: 'commission', tiePayout: 8 },
      sideBets: [
        ...pairBets(),
        {
          id: 'EITHER_PAIR',
          name: 'イーザーペア',
          side: 'P',
          pairTarget: 'either',
          rules: [{ totals: [], cards: 'any', payout: 5 }],
          enabled: false, // 台により有無が異なるためデフォルトOFF
          preset: true,
        },
        ...dragonTigerFamily(),
        {
          id: 'DRAGON_TIGER',
          name: 'ドラゴンタイガー',
          side: 'P',
          // P合計7・B合計6の同時成立。台仕様により30〜100:1(数値編集可)
          rules: [{ totals: [7], cards: 'any', loserTotals: [6], payout: 30 }],
          enabled: true,
          preset: true,
        },
      ],
    }
  }
  // PARADISE(仁川)Dragon Tiger Baccarat
  return {
    // P/B本線の配当は提供データに未記載のため仮デフォルト(現地確認後に編集)
    mainBets: { playerPayout: 1, bankerPayout: 0.95, bankerRule: 'commission', tiePayout: 8 },
    sideBets: [
      ...pairBets(),
      ...dragonTigerFamily(),
      {
        id: 'DRAGON_TIGER',
        name: 'ドラゴンタイガー',
        side: 'P',
        // P合計7・B合計6の同時成立。両者の合計枚数(4/5/6枚)で配当が変わる
        rules: [
          { totals: [7], cards: 'any', loserTotals: [6], totalCards: [4], payout: 30 },
          { totals: [7], cards: 'any', loserTotals: [6], totalCards: [5], payout: 40 },
          { totals: [7], cards: 'any', loserTotals: [6], totalCards: [6], payout: 100 },
        ],
        enabled: true,
        preset: true,
      },
    ],
  }
}

/** 選択カジノの実効構成(カスタム永続値があればそれを、なければプリセット) */
export function casinoConfig(settings: Settings, id?: CasinoId): CasinoConfig {
  const casino = id ?? settings.casino ?? 'PARADISE'
  const custom = settings.casinoCustom?.[casino]
  return custom ? structuredClone(custom) : casinoPreset(casino)
}
