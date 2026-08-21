# Poker Arena — Python SDK

Write a heads-up No-Limit Hold'em bot in a few lines. Standard library only,
Python 3.11+.

The arena POSTs the state of the hand to your HTTPS endpoint and you answer
with an action. This package gives you the wire types, a correct hand
evaluator, the betting arithmetic, and a webhook server that never crashes on
you.

日本語のガイドは [`docs/BOT_DEVELOPMENT.md`](../../docs/BOT_DEVELOPMENT.md)。

---

## 1. Install

Either install it:

```bash
cd sdk/python
pip install -e .
```

…or just copy `poker_arena/` next to your bot. There are no dependencies, so
both work equally well.

## 2. Write a bot

```python
# my_bot.py
from poker_arena import Bot, Request, ActResponse, call, check, fold, raise_to, serve

class MyBot(Bot):
    name = "my-bot"

    def act(self, req: Request) -> ActResponse:
        # Two pair or better: raise 3/4 of the pot.
        if req.hand and req.hand.category >= 2 and req.can_raise:
            return raise_to(req.raise_to_pot_fraction(0.75))
        # Nothing owed: take the free card.
        if req.can_check:
            return check()
        # Facing a bet: call only when the price is right.
        if req.to_call <= req.pot // 4:
            return call()
        return fold()

if __name__ == "__main__":
    serve(MyBot(), port=8080, secret=None)  # secret: see step 5
```

Run it:

```bash
python3 my_bot.py
# poker-arena bot 'my-bot' listening on 0.0.0.0:8080 [UNSIGNED (set secret= before going live)]
```

The three example bots in [`examples/`](examples) are the same shape:

```bash
cd sdk/python
python3 -m examples.always_call   # minimal
python3 -m examples.tight_bot     # a readable strategy to modify
python3 -m examples.equity_bot    # Monte Carlo equity vs pot odds
```

## 3. The protocol

The arena `POST`s an **ActRequest** and expects an **ActResponse**, HTTP 200.
Every amount is an **integer number of chips**; `1bb = 100` chips. A `raise`
amount is the *raise to* total for the street, not the increment.

### ActRequest (exactly what arrives on the wire)

Heads-up, you are seat `0` on the button, holding `Jh Jc` on a `7h 2c Jd`
flop — three jacks — facing a `3bb` bet into a `6bb` pot:

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
  "time_remaining_ms": 1000
}
```

Reading it: `pot` is every chip committed so far — `300` each from preflop
plus the villain's `300` flop bet — so it already includes the bet you are
facing. `players[].bet` is what that seat put in **on the current street**.
`actions[].amount` is likewise a street total, never an increment: the villain
calling `200` more preflop is recorded as `300`. `legal_actions[].min`/`max`
for a raise are *raise to* totals, and `600` is the minimum here because a
raise must be at least the size of the `300` bet.

### ActResponse

```json
{ "action": "raise", "amount": 1200 }
```

`1200` = raise **to** `1200` chips (`12bb`) total for the flop: call the `300`,
then `900` more on top — a 3/4-pot raise (`req.raise_to_pot_fraction(0.75)`).
Calling instead would cost `300` to win `1200`, so `req.pot_odds` is `0.25`.
Or, without any amount:

```json
{ "action": "call" }
```

Schemas: [`act_request.schema.json`](../../packages/protocol/schema/act_request.schema.json),
[`act_response.schema.json`](../../packages/protocol/schema/act_response.schema.json).

## 4. Test it locally

Call your bot directly, no HTTP:

```python
import json
from poker_arena import handle_request
from my_bot import MyBot

req = json.load(open("hand.json"))          # the JSON above
print(handle_request(MyBot(), req))          # {'action': 'raise', 'amount': 1200}
```

`handle_request` runs the same coercion the server does: illegal or crashing
answers come back as check-if-legal-otherwise-fold, and an out-of-range raise
is clamped into `[min, max]`.

Or over HTTP, with a signature the server will accept:

```bash
BODY=$(cat hand.json)
SIG=$(python3 -c "import sys;from poker_arena import sign_body;print(sign_body('my-secret', sys.stdin.buffer.read()))" <<< "$BODY")
curl -sS localhost:8080 -H "content-type: application/json" -H "X-Arena-Signature: $SIG" -d "$BODY"
```

For volume, run hands against the built-in opponents with the arena's
simulator (`pnpm sim --hands 1000`) or `POST /api/test-match`, which plays a
rated-free match and returns the hand ids to replay.

## 5. Go live

1. **Expose an HTTPS endpoint.** Any host works — a VPS, a serverless
   function, a tunnel (`cloudflared tunnel --url http://localhost:8080`,
   `ngrok http 8080`) while you iterate. Plain HTTP is not accepted.
2. **Register the bot.**

   ```bash
   curl -sS https://<arena-host>/api/bots \
     -H "Authorization: Bearer $ARENA_API_KEY" \
     -H "content-type: application/json" \
     -d '{"name":"my-bot","kind":"webhook","webhookUrl":"https://bot.example.com/act"}'
   ```

   Get an API key first with `POST /api/signup` (`{"name":"you"}`). The response
   carries the bot's `id` and its `secret`, returned only once. Pass that secret
   to `serve(..., secret=...)` — read it from the environment, never commit it.
   Every request then carries `X-Arena-Signature: sha256=<hmac-sha256 of the raw body>`,
   and the server rejects anything that does not match.
3. **Activate it**: `POST /api/bots/<id>/activate`. The matchmaker seats it,
   and hands start arriving.
4. **Iterate**: `GET /api/hands?botId=<id>` for your hand histories, and
   `POST /api/bots/<id>/versions` to deploy a new version. Redeploying resets
   that bot's season stats.

Full REST contract: [`docs/API.md`](../../docs/API.md).

## 6. Time limits

a flat `1000ms` per action for every bot, with no time bank. The old rule was `5s` plus
hand. Over the limit, invalid, or an HTTP error, and the arena plays **check if
legal, otherwise fold** for you. `20` consecutive transport failures and the bot
is removed from its table with `status: "error"` until you redeploy.

`serve()` protects you from the crash case — an exception in `act()` becomes a
legal fallback answer, not a 500 — but it cannot make a slow bot fast. Keep your
own hard budget on anything you loop over (`examples/equity_bot.py` shows the
pattern); `req.time_remaining_ms` is optional on the wire and may not arrive.

## 7. API reference

### `poker_arena.Request`

Wraps the raw request dict, which stays available as `req.raw`.

| Member | Meaning |
|---|---|
| `hand_id`, `seat`, `hole_cards`, `board`, `street`, `pot`, `players`, `actions`, `legal_actions` | Straight from the wire |
| `time_remaining_ms` | Your clock for this action — a flat `1000ms`, no bank |
| `hero`, `villain` | The two `PlayerState`s |
| `stack`, `my_bet`, `effective_stack` | Chips behind, chips in this street, what can be won |
| `position` | `"btn"` (button = small blind) or `"bb"` |
| `button_seat` | Seat that posted the small blind |
| `can_fold`, `can_check`, `can_call`, `can_raise` | Legality |
| `to_call` | Chips to call, `0` when you can check |
| `facing_bet` | `to_call > 0` |
| `min_raise`, `max_raise` | Legal *raise to* bounds |
| `pot_odds` | `to_call / (pot after your call)` — the equity a call needs |
| `raise_to_pot_fraction(f)` | *Raise to* amount sizing the raise at `f` of the pot, clamped legal |
| `hand` | Best five-card `HandValue`, or `None` preflop |
| `legal(action)`, `actions_on(street)`, `is_preflop`, `fallback()` | Odds and ends |

### `poker_arena.cards`

```python
evaluate(cards)        # 5-7 cards -> HandValue (the one to call)
evaluate5(cards)       # exactly 5
evaluate7(cards)       # exactly 7
best_five(cards)       # the winning 5 cards, as strings
parse_card("As")       # Card(rank=14, suit='s')
rank_of, suit_of, parse_cards, deck_without, DECK
```

`HandValue.score` is an integer: **higher wins, equal ties**, comparable across
any two hands. `HandValue.category` is one of `HIGH_CARD PAIR TWO_PAIR
THREE_OF_A_KIND STRAIGHT FLUSH FULL_HOUSE FOUR_OF_A_KIND STRAIGHT_FLUSH`
(`0`–`8`), `HandValue.name` its label, `HandValue.ranks` the tiebreak ranks.

```python
>>> evaluate(["As", "Ks", "Qs", "Js", "Ts"]).name
'Straight Flush'
>>> evaluate5(["Ad", "2c", "3h", "4s", "5d"]).ranks[0]      # the wheel is five-high
5
```

### `poker_arena.types`

`CHIPS_PER_BB` (`100`), `SMALL_BLIND` (`50`), `BIG_BLIND` (`100`),
`STARTING_STACK` (`10000`), `to_bb()`, `to_chips()`, the response constructors
`fold() check() call() raise_to(n)`, and TypedDicts mirroring the wire format
(`ActRequest`, `ActResponse`, `PlayerState`, `ActionRecord`, `LegalAction`,
`Street`).

### `poker_arena.server`

`serve(bot, port=8080, secret=None, host="0.0.0.0", log=True)`,
`handle_request(bot, payload)`, `normalize_response(response, req)`,
`sign_body(secret, body)`, `verify_signature(secret, body, header)`.

## 8. Tests

```bash
cd sdk/python
python3 -m pytest tests/ -q      # if pytest is installed
python3 tests/test_evaluator.py  # otherwise — same tests, no dependencies
```

## 9. Season 1 rules

| | |
|---|---|
| Game | Heads-up No-Limit Hold'em, 2 players |
| Stacks | `100bb` (`10000` chips), reset every hand |
| Blinds | SB `50` / BB `100` chips (`1bb = 100`) |
| Rake | 5%, capped at `60` chips (`0.6bb`), no flop no drop |
| Position | The button is the small blind: acts **first** preflop, **last** postflop |
| Ranking | bb/100 after rake, minimum `10000` hands to be listed (`2000` in the beta) |
| Time | `5s` per action + a `30s` time bank (`+2s` per hand) |
