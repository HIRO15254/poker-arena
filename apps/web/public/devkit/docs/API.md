# Poker Arena API 契約(v0.1)

サーバー実装(`apps/server`)とフロントエンド(`apps/web`)、Python SDK が共有する契約。
型定義の正は [`packages/protocol/src/api.ts`](../packages/protocol/src/api.ts)。

- ベース URL(ローカル): `http://localhost:8787`
- 認証: `Authorization: Bearer <apiKey>`。読み取り専用エンドポイントは匿名可。
- 金額は**すべてチップ絶対値**(1bb = 100)。bb 換算は UI 側の責務。
- 日時は ISO 8601 文字列。

## エンドポイント

| メソッド | パス | 認証 | 内容 |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok: true, season: SeasonConfig, tables: number, bots: number }` |
| GET | `/api/season` | – | `SeasonConfig` |
| GET | `/api/builtins` | – | `{ strategies: string[] }` 組み込み戦略の一覧 |
| GET | `/api/leaderboard` | – | `LeaderboardResponse` |
| GET | `/api/bots` | 要 | 自分の bot 一覧 `BotSummary[]` |
| POST | `/api/bots` | 要 | `CreateBotRequest` → `BotDetail`(`secret` を含む) |
| GET | `/api/bots/:id` | 任意 | `BotDetail`(他人の bot は公開項目のみ) |
| POST | `/api/bots/:id/versions` | 要 | `DeployVersionRequest` → `BotDetail`。**シーズン成績はリセット** |
| POST | `/api/bots/:id/activate` | 要 | 稼働開始 → `BotDetail` |
| POST | `/api/bots/:id/deactivate` | 要 | 稼働停止 → `BotDetail` |
| DELETE | `/api/bots/:id` | 要 | 削除 |
| GET | `/api/tables` | – | `TableSummary[]` |
| GET | `/api/tables/:id` | – | `TableView` |
| WS | `/api/tables/:id/watch` | – | `TableWatchEvent` を配信 |
| GET | `/api/hands?botId=&limit=&cursor=&minNet=&maxNet=&showdown=` | 要 | `{ hands: HandSummary[], nextCursor: string \| null }` |
| GET | `/api/hands/:handId` | 要 | `HandDetail`(自分視点) |
| POST | `/api/test-match` | 要 | `TestMatchRequest` → `TestMatchResponse`。レーティング非反映。現在は kind=builtin の bot のみ、相手は組み込み戦略のみ、ハンド数は 2000 まで。履歴は保存しないので `sampleHandIds` は空 |
| GET | `/api/me` | 要 | `{ id, name, botLimit }`。apiKey はハッシュ保存のため返らない |

### エラー

HTTP ステータス + `ApiError` ボディ。`401 unauthorized` / `403 forbidden` / `404 not_found` /
`400 invalid_request` / `409 conflict`(bot 上限超過など)/ `429 rate_limited`。

## bot Webhook 契約(現在停止中)

> `GET /api/season` の `webhookBotsEnabled` が `false` の間、webhook 型 bot の登録・デプロイは
> `400` で拒否され、リーグでも対戦対象にならない。以下は再開後の契約。

アリーナが bot の `webhookUrl` に **POST** する。

- ヘッダ: `Content-Type: application/json`、`X-Arena-Signature: sha256=<hex>`(HMAC-SHA256、bot のシークレット)、`X-Arena-Hand-Id`
- ボディ: [`ActRequest`](../packages/protocol/schema/act_request.schema.json)
- レスポンス: [`ActResponse`](../packages/protocol/schema/act_response.schema.json)、HTTP 200
- 制限時間: **1 アクション 1000ms 固定**(タイムバンクなし)。超過・不正・HTTP エラーは
  **check 可能なら check、不可なら fold**
- 連続 20 回のタイムアウトで自動離席(`status: "error"`)

## シーズン1(HU NLH)

| 項目 | 値 |
|---|---|
| 種目 | ヘッズアップ ノーリミット・ホールデム(2人) |
| スタック | 毎ハンド 100bb リセット |
| ブラインド | SB 50 / BB 100(チップ) |
| レーキ | 5%、キャップ 60(0.6bb)、no flop no drop |
| ポジション | ボタン = SB(プリフロップ先行、ポストフロップ後手) |
| ランキング | bb/100(レーキ控除後)。最低 10,000 ハンド |
| 再デプロイ | シーズン成績リセット |

## 人間 vs bot のプレイ(ブラウザ)

サーバー権威。セッションは `(デッキシード, hero のアクション列)` から決定的に再構築されるため、
DO が退避されても状態が失われない。

| メソッド | パス | 認証 | 内容 |
|---|---|---|---|
| POST | `/api/play` | – | `CreatePlayRequest` → `PlaySession` |
| GET | `/api/play/:id` | – | `PlaySession` |
| POST | `/api/play/:id/act` | – | `PlayActRequest` → `PlaySession` |
| POST | `/api/play/:id/next` | – | 次のハンドを開始 → `PlaySession` |

- `phase: "acting"` かつ `toAct === heroSeat` のときのみ `legalActions` が非空。
- `phase: "hand_over"` のとき `lastHand` に結果が入る。`/next` で次ハンドへ。
- raise の `amount` は **raise to**(そのストリートの合計額)。`legalActions` の `min`/`max` 範囲外は不正。
