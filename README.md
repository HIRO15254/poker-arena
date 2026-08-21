# Poker Arena(仮称)

自作ポーカーボットを持ち寄って対戦させるアリーナ。ブラウザから人間が bot と対戦することもできる。
AI エージェント(Claude Code 等)による bot 開発を REST API / ドキュメントで第一級にサポートする。

**公開先**: https://vcode-poker-arena.hiro15254.com

## Season 1 — Heads-Up NLH

| 項目 | 値 |
|---|---|
| 種目 | ヘッズアップ ノーリミット・ホールデム(2人) |
| スタック | 毎ハンド 100bb にリセット |
| ブラインド | SB 50 / BB 100 チップ(1bb = 100 チップ) |
| レーキ | 5%、キャップ 60(0.6bb)、no flop no drop |
| ポジション | ボタン = SB(プリフロップ先行・ポストフロップ後手) |
| ランキング | bb/100(レーキ控除後)、最低 2,000 ハンドで掲載 |
| 持ち時間 | 1 アクション 1000ms 固定(タイムバンクなし) |
| 対戦 | 1時間に1ラウンド。持ち主が異なる bot 同士を総当たり、1組 1000 ハンド |
| 期間 | 1ヶ月。再デプロイでシーズン成績はリセット |

仕様の全体は [SPEC.md](SPEC.md)、API は [docs/API.md](docs/API.md)、
bot の作り方は [docs/BOT_DEVELOPMENT.md](docs/BOT_DEVELOPMENT.md) を参照。

## 構成(pnpm workspaces)

- `packages/engine` — ゲームエンジン(2〜9人対応、純粋ロジック、RNG 注入可)
- `packages/protocol` — bot プロトコル / シーズン設定 / REST API の型定義 + JSON Schema
- `packages/simulator` — ローカルシミュレータ CLI とベンチマーク bot 群
- `apps/server` — Cloudflare Workers(Hono + D1 + cron)
- `apps/web` — React SPA
- `sdk/python` — Python 製 bot のスターターキット

## 開発

```bash
pnpm install
pnpm test          # エンジン・プロトコル・シミュレータのテスト
pnpm typecheck
pnpm sim --hands 2000 --bots tight,call   # ローカル対戦
```

サーバーとフロントをローカルで動かす:

```bash
pnpm --filter @poker-arena/web build
pnpm --filter @poker-arena/server dev
```

## デプロイ

```bash
pnpm --filter @poker-arena/web build
pnpm --filter @poker-arena/server deploy
```

D1 のスキーマ変更を反映する場合:

```bash
cd apps/server && npx wrangler d1 execute poker-arena --remote --file schema.sql
```

### ドメイン

本番は `vcode-poker-arena.hiro15254.com`(Cloudflare のカスタムドメイン)。
`vcode-poker-arena.hiro15254.workers.dev` も引き続き到達できる。
設定は `apps/server/wrangler.jsonc` の `routes`。HTTP でのアクセスは Worker 側で
HTTPS へ 301 リダイレクトする(ゾーン設定に依存しない)。
