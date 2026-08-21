# Poker Arena bot 開発キット

ヘッズアップ NLH の bot を書くのに必要なものを 1 つにまとめたもの。
中身は Python 標準ライブラリだけで動く。`git clone` も `pip install` も要らない。

| パス | 中身 |
|---|---|
| `poker_arena/` | SDK 本体。ワイヤ型・ハンド評価・ベット計算・webhook サーバ |
| `examples/` | 動く bot 3 つ(`always_call.py` / `tight_bot.py` / `equity_bot.py`) |
| `tests/` | SDK のテスト。`python3 tests/test_evaluator.py` で単体実行できる |
| `check_bot.py` | 提出前のコード長チェッカ |
| `docs/` | 開発ガイド・REST API 契約・AI エージェント向け索引 |
| `schema/` | `ActRequest` / `ActResponse` の JSON Schema |
| `README.md` | SDK のクイックスタートと API リファレンス |

SDK は Python `3.11` 以上で動く。アップロード型 bot の実行環境は Python `3.12`。

## 1. シーズン1のルール

| 項目 | 値 |
|---|---|
| 種目 | ヘッズアップ ノーリミット・ホールデム(`2` 人) |
| スタック | 毎ハンド `100bb`(`10000` チップ)にリセット |
| ブラインド | SB `50` / BB `100` チップ(`1bb = 100` チップ) |
| レーキ | `5%`、キャップ `60` チップ(`0.6bb`)、no flop no drop |
| ポジション | **ボタン = SB**。プリフロップは先行、ポストフロップは後手 |
| ランキング | bb/100(レーキ控除後)、掲載は最低 `2000` ハンドから |

金額は**すべてチップ絶対値の整数**。bb 換算は表示のときだけ行う。
掲載条件の `2000` はベータ期間の値で、既定値は `10000` ハンド。

## 2. 制限時間

1 アクションあたり **`1000ms` 固定**。タイムバンクはない。方式にも残高にもよらず、
どの bot もどの局面でも同じ持ち時間になる。

制限を超えた応答、不正な応答、エラーはすべて
**チェックできればチェック、できなければフォールド** に置き換えられる。
`20` 回連続で失敗すると `status: "error"` になり、再デプロイまで卓から外れる。

ループを回すコードには自前のハード予算を置くこと(`examples/equity_bot.py` にその形がある)。

## 3. 提出できるコード

- `.py` ファイル **`1` つだけ**。
- **コードバイトは `8192` バイトまで**。コードバイト = `#` コメントと空行を除いた UTF-8 バイト数。
- docstring を含む**文字列リテラルは数える**。レンジ表を docstring に置いて `__doc__` から
  パースする抜け道を塞ぐため。長い説明は `#` コメントで書く。
- ファイル全体の生バイト数は `256KB` まで。

データ量ではなくロジックで competing させるための制限。手元で確認する:

```bash
python3 check_bot.py mybot.py
```

判定はアリーナ側とバイト単位で一致する。

## 4. 60 秒で始める

```bash
cp examples/tight_bot.py mybot.py
```

`mybot.py` の判断部分を書き換える。触る場所は `PLUG IN` と書いてある 3 つ:

1. `preflop_class` — どのハンドをどのポジションで打つか
2. `board_strength` — ボードが開いたあとのハンドの格付け
3. `TightBot.preflop` / `TightBot.postflop` — サイズと閾値

書けたら長さを確認する:

```bash
python3 check_bot.py mybot.py
```

SDK 自体が動くことを確かめるなら `python3 tests/test_evaluator.py`。

## 5. 次に読むもの

1. [`docs/BOT_DEVELOPMENT.md`](docs/BOT_DEVELOPMENT.md) — アリーナの仕組み、webhook 契約、
   実際に届く JSON、ローカルテスト、登録手順。最初に読む。
2. [`docs/API.md`](docs/API.md) — REST の全エンドポイントと署名、エラーコード。
3. [`schema/act_request.schema.json`](schema/act_request.schema.json) /
   [`schema/act_response.schema.json`](schema/act_response.schema.json) — ワイヤ形式の正。
4. [`README.md`](README.md) — `Request` / `cards` / `types` / `server` の API リファレンス。

`docs/` の中のリンクはリポジトリのパス基準で書かれている。このキットでは
`sdk/python/` 以下がルート直下に、`packages/protocol/schema/` が `schema/` に置いてある。

## 6. AI エージェントに渡す

[`docs/llms.txt`](docs/llms.txt) が索引。ルール・プロトコル・SDK・サンプルの
どれがどこにあるかを 1 ファイルにまとめてある。AI コーディングエージェントには
まずこれを読ませるのが早い。
