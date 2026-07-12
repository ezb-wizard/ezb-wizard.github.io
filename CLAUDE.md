# EZバカラ 記録・資金管理アプリ

個人利用のEZバカラ(ノーコミッションバカラ)専用セッション記録・資金管理PWA。
韓国カジノ想定(基準通貨KRW、JPY常時併記)。スマホ縦画面・片手操作前提。
元の要件定義: `~/Downloads/baccarat_app_claude_code_prompt_1.md`(リポジトリ外)。

## コマンド

- `npm run dev` — 開発サーバー(Vite)
- `npm run build` — 型チェック + 本番ビルド(PWA/service worker生成込み)
- `npm test` — vitest(精算エンジン・確率テーブルの受け入れ基準検証)

## 設計原則(変更しないこと)

- 各ハンドは独立試行。**結果予測・勝利保証に類する機能は実装禁止**(要件の最重要項目)
- 確率はハードコードせず `src/lib/baccarat.ts` の**8デッキ完全列挙**から導出する。
  仕様値(B 45.86% / P 44.62% / T 9.52% / D7 2.25%、控除率 1.02/1.24/14.36/7.61%)との一致は
  `src/lib/__tests__/baccarat.test.ts` が保証
- サイドベット控除率は「内蔵確率 × 設定配当」から動的算出(`sidebets.ts` の `sideBetStats`)。
  カジノごとに配当が異なるため固定値を書かない

## アーキテクチャ

- React 19 + TypeScript + Vite + Tailwind v4(`@theme`トークンは `src/index.css`)
- 状態: zustand(`src/store.ts`)。永続化: Dexie/IndexedDB(`src/lib/db.ts`、完全ローカル)
- 精算エンジン: `src/lib/settle.ts`
  - `settleBet/settleHand` — EZルール(D7でバンカー本線プッシュ、タイでB/Pプッシュ、タイ8:1/9:1)
  - `totalNeed/cardsNeed` — 結果入力時の補助入力(勝利合計値・枚数)の必須/省略可/不要判定。
    UI(PlayScreen の ResultSheet・HandEditModal)はこの2関数に従う
- サイドベットは `SideBetDef`(side × rules[totals × cards × payout])で汎用表現。
  プリセット(D7/B6/P7/パンダ8/タイガー系)+カスタム定義。ハンド記録は勝者+勝利合計値+枚数のみで
  全サイドベットの成立を自動導出する(専用ボタンを増やさない)
- 為替: `src/lib/rates.ts`。KRW per JPY。フォールバック: open.er-api → frankfurter → Dexieキャッシュ → 手動入力。
  起動時+1時間ごと更新。手動固定モードあり
- シミュレーター: `src/workers/sim.worker.ts`(Web Worker)。本番と同じ `settleBet` を使用。
  結果分布は完全列挙テーブルを圧縮(winner×wTotal×wCards)して渡す
- 大路: `src/lib/road.ts`(配置ロジック)+ `src/components/BigRoad.tsx`(SVG描画)

## UI規約

- ダークテーマ固定: 深緑 `felt-*` × ゴールド `gold-*`。チャート/出目色(バンカー`#e2685f`・
  プレイヤー`#4e97d6`・タイ`#35a366`・ゴールド`#b58c3c`)はdatavizパレット検証済み。変える場合は再検証
- タップターゲット最小48px(`h-12`以上)、数値は `.num`(等幅)
- 金額は `fmtBoth`(₩3桁区切り+約¥併記)を使う
- 資金管理まわりには「期待値マイナスでは賭け金最適化は成立しない」旨の注記を常設(削除しない)

## 検証

UIスモークはPlaywright+システムEdgeで実施可能(scratchpadに `smoke.mjs` の例)。
`executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'`
