# Poker Arena(仮称)

自作ポーカーボットを持ち寄って対戦させるアリーナ。NLHE 6-max、100bb、レーキ 5%(キャップ 4bb)。
AI エージェント(Claude Code 等)による bot 開発を API / MCP で第一級にサポートする。

仕様は [SPEC.md](SPEC.md)、開発ルールは [CLAUDE.md](CLAUDE.md) を参照。

## 構成(pnpm workspaces)

- `packages/engine` — ゲームエンジン(純粋ロジック、RNG 注入可)
- `packages/protocol` — bot プロトコルの型定義 + JSON Schema
- `packages/simulator` — ローカルシミュレータ CLI(内蔵ベンチマーク bot 付き)
- `apps/api` — Cloudflare Workers(REST / MCP、テーブル Durable Objects)※未実装
- `apps/web` — フロントエンド ※未実装

## 開発

```bash
pnpm install
pnpm test
pnpm sim --hands 1000
```
