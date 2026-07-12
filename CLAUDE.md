# EZ Baccarat Wizard(EZバカラ記録・資金管理)

EZバカラ専用セッション記録・資金管理PWA。韓国カジノ(PARADISE仁川/INSPIRE仁川)想定、基準通貨KRW+JPY併記。スマホ縦画面・片手操作・完全ローカル(IndexedDB)・オフライン対応。
元の要件定義: `~/Downloads/baccarat_app_claude_code_prompt_1.md`(v1)+ v2改修依頼(カジノプリセット/テーマ刷新/JPY入力)。

## コマンド

- `npm run dev` — 開発サーバー(Vite)
- `npm run build` — 型チェック + 本番ビルド(PWA/service worker生成込み)
- `npm test` — vitest(精算エンジン・確率テーブルの受け入れ基準検証)
- `npm run icons` — `public/logo.png` からPWAアイコン一式を再生成(sharp)

## 設計原則(変更しないこと)

- 各ハンドは独立試行。**結果予測・勝利保証に類する機能は実装禁止**(要件の最重要項目)
- 確率はハードコードせず `src/lib/baccarat.ts` の**8デッキ完全列挙**から導出する。
  最初の4枚はランク単位(13×32枚)で列挙しペア(同ランク)を厳密に扱う。仕様値
  (B 45.86% / P 44.62% / T 9.52% / D7 2.25%、ペア7.47%、各控除率)との一致はテストが保証
- 控除率は「内蔵確率 × 設定配当」から動的算出(`sidebets.ts sideBetStats` / `baccarat.ts mainBetEdges`)
- **精算はセッション開始時のスナップショット**(`session.mainBets` / `session.sideBets`)を使う。
  設定・プリセットを後から変えても過去セッションの損益は不変
- 旧データ互換: `mainBets` の無い旧セッションは `sessionRules()`(types.ts)でEZルール+当時のタイ配当に解決。
  旧ハンドの新フィールド(loserTotal等)は undefined → `== null` 判定で吸収。Dexieはversion(2)で追補済み

## ドメインモデル(v2)

- `MainBetRules`: バンカー本線 `'ez'`(1:1・D7プッシュ)/ `'commission'`(bankerPayout倍・プッシュなし)+ player/tie配当
- `SideBetDef`: `pairTarget`(P/B/either = ペア系、勝者と無関係)または `side`+`rules[]`。
  `SideBetRule` = totals × cards × loserTotals(負け側合計・Dragon Tiger)× totalCards(両者合計枚数・PARADISE DT 4/5/6枚)× payout
- カジノプリセット: `src/lib/casinos.ts`(`casinoPreset` / `casinoConfig` = settings.casinoCustomのカスタム値優先)
- 入力要否: `settle.ts` の `totalNeed / cardsNeed / loserNeed / pairNeed`。
  ResultSheet(PlayScreen)とHandEditModalは必ずこの4関数に従う。**サイドベット全OFF時に
  3タップ以内(コミッション式は勝者タップのみ)を壊さないこと**
- 開始資金のJPY入力: `session.startInput` に通貨/金額/適用レート/取得時点を記録

## アーキテクチャ

- React 19 + TypeScript + Vite + Tailwind v4。状態: zustand(`src/store.ts`)、永続化: Dexie(`src/lib/db.ts`)
- 精算エンジン: `src/lib/settle.ts`(settleBet/settleHand/matchRule)。Workerも同じ関数を使用
- シミュレーター: `src/workers/sim.worker.ts`(完全列挙テーブルをそのままサンプリング)
- 為替: `src/lib/rates.ts`(er-api→frankfurter→キャッシュ→手動)。大路: `src/lib/road.ts`

## UI規約(テーマ「Casino Luxe」ダーク固定)

- トークンは `src/index.css` の `@theme` に集約: base-*(ダークネイビー)、gold-*(シャンパンゴールド、
  INSPIRE選択時は `[data-casino='INSPIRE']` でシアンに切替)、win/lose(損益)、banker/player/tie(識別色)
- 識別色はdataviz検証済(surface #111826): banker `#e5484d` / player `#4e97d6` / tie `#b58c3c`。変更時は再検証
- 共通クラス: `.card-luxe`(ガラス調カード)、`.btn-gold`、`.press`(押下150ms)、`.flash-win/lose/push`(登録時250ms)
- 数値は `.num`(Space Grotesk・tabular-nums)。タップターゲット最小48px。金額は `fmtBoth`
- 主要操作(チップ/スポット/結果ボタン)はPlayScreen下部のsticky操作クラスタに置く(親指リーチ)
- 「期待値マイナスでは賭け金最適化は成立しない」注記は削除しない

## 検証

UIスモークはPlaywright+システムEdge(`executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'`)。
`main` へのpushでGitHub Actionsがテスト→ビルド→GitHub Pagesデプロイ(https://daisukesekino.github.io/EZ-Baccarat/)。
