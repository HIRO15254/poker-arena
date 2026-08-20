# bot 開発ガイド

ポーカー bot を書いてアリーナに登録するための手引き。
Python SDK は [`sdk/python/`](../sdk/python/README.md)、REST API の契約は [`docs/API.md`](API.md)、
型の正は [`packages/protocol/src/index.ts`](../packages/protocol/src/index.ts)。

---

## 1. アリーナの仕組み

- アリーナは稼働中の bot を**毎分のリーグバッチ**で総当たりに組み、ハンドを回す(Webhook 型を含むペアは 1 バッチあたり `12` ハンド前後。暫定値)。
- 1 アクションごとに、アリーナが bot へゲーム状態(`ActRequest`)を送り、bot がアクション(`ActResponse`)を返す。ボタンは 1 ハンドごとに入れ替わる。
- 順位は **bb/100**(レーキ控除後)。掲載条件は現行バージョンで最低 `10,000` ハンド(シーズン1(ベータ)は `2,000` ハンド)。
- シーズンは 1 ヶ月単位。**bot を再デプロイするとそのシーズン成績はリセット**される。
- ハンド履歴は**自分視点のみ**閲覧可。相手のホールカードはショーダウンで公開された分だけ記録される。
- 同一ユーザーの bot は同卓しない。

### 実行方式

| 方式 | 状態 | 内容 |
|---|---|---|
| **Webhook 型** | 現行 | 自分の HTTPS エンドポイントを登録。言語・計算資源は自由。制限は時間のみ |
| アップロード型 | Phase 3 で提供予定 | Python コードをアップロードし、サンドボックス(egress 禁止)で実行 |

本ガイドは Webhook 型を扱う。プロトコルは両方式で共通なので、書いた戦略コードはそのまま移せる。

## 2. シーズン1のルール

| 項目 | 値 |
|---|---|
| 種目 | ヘッズアップ ノーリミット・ホールデム(`2` 人) |
| スタック | 毎ハンド `100bb`(`10,000` チップ)にリセット |
| ブラインド | SB `50` / BB `100` チップ(`1bb = 100` チップ) |
| レーキ | `5%`、キャップ `60` チップ(`0.6bb`)、no flop no drop |
| ポジション | **ボタン = SB**。プリフロップは先行、ポストフロップは後手 |
| ミニマムレイズ | 直前のフルレイズ幅以上(標準ルール) |
| アンティ / ストラドル | なし |
| ランキング | bb/100(レーキ控除後)、最低 `10,000` ハンド(ベータ期間は `2,000`) |

金額は**すべてチップ絶対値の整数**。bb 換算は表示のときだけ行う。

## 3. Webhook 契約

> **現在 webhook 型 bot は受け付けていない。** `GET /api/season` の `webhookBotsEnabled` が
> `false` の間はアリーナが外部へ通信しないため、登録すると `400` になる。
> 以下は再開後の契約で、SDK とローカルテストはそのまま使える。

アリーナが登録された `webhookUrl` に **POST** する。

| 項目 | 値 |
|---|---|
| メソッド | `POST` |
| ヘッダ | `Content-Type: application/json`、`X-Arena-Signature: sha256=<hex>`、`X-Arena-Hand-Id` |
| ボディ | [`ActRequest`](../packages/protocol/schema/act_request.schema.json) |
| 応答 | [`ActResponse`](../packages/protocol/schema/act_response.schema.json) を HTTP `200` で |

`X-Arena-Signature` は **生のリクエストボディ**に対する HMAC-SHA256(鍵は bot 登録時に払い出されるシークレット)。
検証は必ず定数時間比較(Python なら `hmac.compare_digest`)で行う。

### ActRequest(実際に届く JSON)

自分は席 `0`(ボタン = SB)。`Jh Jc` を持ち、フロップ `7h 2c Jd` でスリーカード。
相手の `3bb` ベットに直面している例:

```json
{
  "type": "act",
  "hand_id": "h_01J8ZQK7Y6R2M0V3N4T5W6X7Y8",
  "seat": 0,
  "hole_cards": ["Jh", "Jc"],
  "board": ["7h", "2c", "Jd"],
  "street": "flop",
  "pot": 900,
  "players": [
    { "seat": 0, "stack": 9700, "bet": 0, "status": "active" },
    { "seat": 1, "stack": 9400, "bet": 300, "status": "active" }
  ],
  "actions": [
    { "seat": 0, "street": "preflop", "action": "post_sb", "amount": 50 },
    { "seat": 1, "street": "preflop", "action": "post_bb", "amount": 100 },
    { "seat": 0, "street": "preflop", "action": "raise", "amount": 300 },
    { "seat": 1, "street": "preflop", "action": "call", "amount": 300 },
    { "seat": 1, "street": "flop", "action": "bet", "amount": 300 }
  ],
  "legal_actions": [
    { "action": "fold" },
    { "action": "call", "amount": 300 },
    { "action": "raise", "min": 600, "max": 9700 }
  ],
  "time_remaining_ms": 5000,
  "time_bank_ms": 2500
}
```

読み方:

- `pot` は**これまでに拠出された全チップ**。相手の `300` ベットも既に含む(プリフロップ `300` × 2 + フロップ `300` = `900`)。
- `players[].bet` は**そのストリートで**その席が出した額。`stack` は手元に残っているチップ。
- `actions[].amount` は常に**そのストリートの合計額**であって増分ではない。上の `call` は `200` 追加だが `300` と記録される。
- `legal_actions` の `raise` の `min`/`max` は「**raise to**(そのストリートの合計額)」。この例の `min: 600` は「`300` のベットに対するミニマムレイズ」。`max: 9700` はオールイン。
- `call` の `amount` は自分のスタックで上限クリップ済み。コールがスタックを超えることはない。
- `hole_cards` / `board` は `"As"` `"Td"` `"7h"` 形式(rank `23456789TJQKA` / suit `cdhs`)。

### ActResponse

```json
{ "action": "raise", "amount": 1200 }
```

- `amount` は **raise to**。この例は「`300` をコールした上でさらに `900` 上乗せして合計 `1200` にする」= ポットの `3/4` レイズ。
- `fold` / `check` / `call` は `{"action": "call"}` のように `amount` なしで返す。
- `legal_actions` に無いアクション、`min`/`max` 範囲外の `raise`、スキーマ違反はすべて**不正**として扱われる(§4)。範囲外の `raise` はクランプされない。

## 3.5 アップロード型のコード長制限

サンドボックス実行はまだ動いていないが、受け入れ条件は確定している。

| 項目 | 値 |
|---|---|
| ファイル数 | `1`(`.py` のみ) |
| コード長 | `8192` バイト以内 |
| 数え方 | `#` コメントと空行を除いた UTF-8 バイト数 |
| 文字列リテラル | **数える**(docstring も含む) |
| ファイル全体 | `256KB` 以内 |

docstring を数えるのは、免除するとレンジ表を docstring に置いて `__doc__` から
読み出す抜け道ができるため。長い説明は `#` コメントで書けば一切消費しない。

狙いは「データ量ではなくロジックで勝負させる」こと。巨大な事前計算テーブルは入らない。

提出前に手元で確認できる:

```bash
python3 sdk/python/check_bot.py mybot.py     # SDK 側
pnpm measure mybot.py                        # アリーナと同じ実装
```

参考として、SDK の `examples/tight_bot.py` は `7,506` バイト(残り `686`)。
コメントを十分に書いたまともな bot がぎりぎり収まる水準に設定してある。

## 4. 制限時間とタイムバンク

| 項目 | 値 |
|---|---|
| 基本制限時間 | Webhook 型 `5` 秒(ネットワーク往復込み) |
| タイムバンク | 初期 `1` 秒。基本制限の超過分を消費し、ハンド開始ごとに `+0.5` 秒回復(上限 `10` 秒)。ハンドをまたいで持ち越す。再デプロイ・稼働開始で `1` 秒に戻る |
| 超過・不正・HTTP エラー時 | **check 可能なら check、不可なら fold** |
| 自動離席 | タイムアウト・HTTP エラー・JSON として読めない応答が `20` 回連続すると `status: "error"` になり、再デプロイまで復帰しない |

`legal_actions` に無いアクションを返した場合も check/fold に強制変換されるが、応答自体は届いているので自動離席の
カウントには入らない。**静かに全ハンド check/fold されて負け続ける**ことになるので、応答が合法かは自分で担保する。

強制処理されたアクションはハンド履歴に `"forced": true` として残る。**ここが増えていたら戦略ではなく速度と安定性の問題**。

対策:

- 重い計算には**自前のハード期限**を置き、超えたら途中結果で返す(`sdk/python/examples/equity_bot.py` の実装がこの形)。`time_remaining_ms` / `time_bank_ms` は任意フィールドで、届かないこともある。当てにせず自分で計測する。
- 例外で `500` を返さない。SDK の `serve()` は `act()` の例外を捕捉して check/fold にフォールバックする。
- コールドスタートの遅いサーバーレスは不利。常駐プロセスか、ウォームアップ済みの環境を推奨。

## 5. ローカルでテストする

### SDK で直接呼ぶ(HTTP なし)

```bash
cd sdk/python
python3 -m examples.tight_bot          # サーバーとして起動
python3 tests/test_evaluator.py        # ハンド評価器のテスト(pytest 不要)
```

```python
import json
from poker_arena import handle_request
from my_bot import MyBot

req = json.load(open("hand.json"))   # 上の ActRequest をそのまま保存したもの
print(handle_request(MyBot(), req))  # {'action': 'raise', 'amount': 1200}
```

`handle_request()` はアリーナと同じ強制処理を通す。不正な応答・例外は check/fold になり、
範囲外の `raise` は `[min, max]` にクランプされる。

### 署名付きの HTTP を投げる

```bash
BODY=$(cat hand.json)
SIG=$(python3 -c "import sys;from poker_arena import sign_body;print(sign_body('my-secret', sys.stdin.buffer.read()))" <<< "$BODY")
curl -sS localhost:8080 -H "content-type: application/json" -H "X-Arena-Signature: $SIG" -d "$BODY"
```

### 数をこなす

- ローカルシミュレータ: `pnpm sim --hands 1000 --bots tight,call`(内蔵ベンチマーク bot 同士。同一エンジン)。
- アリーナ側のテスト対戦: `POST /api/test-match`(`botId`、`opponent`、`hands`)。**レーティング非反映**で、リプレイ用のハンド id が返る。

## 6. 登録と稼働開始

0. **API キーを取得する。** `POST /api/signup` に `{"name":"<表示名>"}` を投げると `apiKey` が返る(v1 の暫定方式。公開時に GitHub OAuth へ差し替え予定)。以降のリクエストは `Authorization: Bearer <apiKey>`。

   ```bash
   curl -sS https://<arena-host>/api/signup -H "content-type: application/json" -d '{"name":"your-name"}'
   ```

1. **HTTPS エンドポイントを用意する。** ホスティングは自由(VPS、サーバーレス、開発中は `cloudflared tunnel --url http://localhost:8080` や `ngrok http 8080` でも可)。平文 HTTP は不可。
2. **bot を登録する。**

   ```bash
   curl -sS https://<arena-host>/api/bots \
     -H "Authorization: Bearer $ARENA_API_KEY" \
     -H "content-type: application/json" \
     -d '{"name":"my-bot","kind":"webhook","webhookUrl":"https://bot.example.com/act"}'
   ```

   応答の `id` が bot の識別子、`secret` が署名シークレット。`secret` は自分の bot であれば
   `GET /api/bots/:id` でいつでも取得できる(他人には返らない)。
   環境変数で渡し、**リポジトリに commit しない**。

   ```python
   import os
   serve(MyBot(), port=8080, secret=os.environ["ARENA_BOT_SECRET"])
   ```

3. **稼働開始**: `POST /api/bots/:id/activate`。マッチメイカーが着席させ、ハンドが届き始める。
4. **停止**: `POST /api/bots/:id/deactivate`。
5. **更新**: `POST /api/bots/:id/versions`(`webhookUrl` の変更 or 単なるバージョン記録)。**シーズン成績はリセット**されるので、大きな変更をまとめてから出す。

bot は 1 ユーザーあたり `3` 個まで(暫定)。全て同時稼働できるが同卓はしない。

## 7. AI エージェントで開発ループを回す

このアリーナはハンド履歴を機械可読で返すので、Claude Code 等に**負けたハンドを読ませて直させる**のが最短ルート。

### 手順

1. エージェントに文脈を渡す。リポジトリ内なら [`docs/llms.txt`](llms.txt) を読ませれば、ルール・プロトコル・SDK の場所が一度に伝わる。

   ```
   docs/llms.txt を読んで、このアリーナの bot プロトコルとシーズン1ルールを把握して。
   ```

2. 負けたハンドを取ってくる。

   ```bash
   curl -sS "https://<arena-host>/api/hands?botId=$BOT_ID&limit=50&maxNet=-2000" \
     -H "Authorization: Bearer $ARENA_API_KEY" > hands.json
   curl -sS "https://<arena-host>/api/hands/$HAND_ID" \
     -H "Authorization: Bearer $ARENA_API_KEY" > hand.json
   ```

   `GET /api/hands` のフィルタ: `botId` / `limit` / `cursor` / `minNet` / `maxNet` / `showdown`。
   `GET /api/hands/:handId` は全アクション、ストリートごとのボード、レーキ、ボタン位置を含む自分視点の詳細。

3. 傾向を出させる。

   ```
   hands.json は自 bot の直近の負けハンド 50 件。ポジション別・ストリート別に損失を集計して、
   一番損しているスポットを 3 つ挙げて。`"forced": true` のアクションがあればそれも報告して。
   ```

4. 修正させ、ローカルで検証させる。

   ```
   sdk/python/examples/tight_bot.py をベースに、3 で挙がったスポットの打ち方を直して。
   直したら handle_request() に hand.json を通して、意図通りのアクションになるか確認して。
   ```

5. `POST /api/test-match` で対戦させ、bb/100 が改善したら新バージョンをデプロイする。

### API クライアント

ハンド履歴の取得とデプロイは SDK のクライアントから行える(依存なし)。

```python
from poker_arena import ArenaClient, to_bb

arena = ArenaClient(api_key="pa_...")

# 大きく負けたハンドだけ抜き出して、AI に読ませる
for h in arena.hands(limit=200):
    if to_bb(h["net"]) < -30:
        detail = arena.hand(h["handId"])
        print(detail["holeCards"], detail["board"], detail["actions"])

# 直したら再デプロイ(シーズン成績はリセットされる)
arena.deploy(bot_id, webhook_url="https://example.com/act", note="river の降り過ぎを修正")
arena.activate(bot_id)
```

自前で HTTP を書く場合は **User-Agent を必ず設定する**。既定の
`Python-urllib/x.y` は前段の CDN にボットとして遮断され、JSON ではなく
HTML の `403` が返る。

### エージェントに渡すと効くもの

| 対象 | 場所 |
|---|---|
| ルール・プロトコル・SDK の索引 | [`docs/llms.txt`](llms.txt) |
| REST API 契約 | [`docs/API.md`](API.md) |
| JSON Schema | [`act_request`](../packages/protocol/schema/act_request.schema.json) / [`act_response`](../packages/protocol/schema/act_response.schema.json) |
| Python SDK とサンプル bot | [`sdk/python/`](../sdk/python/README.md) |

### 注意

- `"forced": true` が並んでいるハンドは戦略の問題ではない。まず速度・可用性を疑う。
- 短いサンプルで判断しない。bb/100 の分散は大きく、`1,000` ハンド程度の差は誤差に埋もれる。掲載条件が `10,000` ハンドなのはそのため。
- 再デプロイはシーズン成績をリセットする。細かい修正を毎回出すより、まとめて出したほうが順位は安定する。
