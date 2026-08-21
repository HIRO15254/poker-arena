"""Monte Carlo equity vs a random villain, compared against the pot odds.

The idea in one line: deal the villain a random hand and the rest of the board
a few thousand times, count how often you win, and call only when your win rate
beats the price you are being offered.

Cost, measured on CPython 3.14 / Apple Silicon with this SDK's evaluator
(5 runs per street, median):

    ROLLOUTS = 1500 -> 0.26s preflop, 0.26s flop, 0.26s turn, 0.23s river
                       (~0.17ms per rollout; two 7-card evaluations each)

The webhook budget is `5s` per action, so that is a ~20x margin — room for a
much slower machine, and for raising ROLLOUTS if you want a tighter estimate
(the error shrinks with the square root, so 4x the samples halves it).  :data:`TIME_BUDGET_S` is a hard stop regardless: the loop
breaks early and answers with the samples it has, because a late answer is
scored as check/fold.

Run it:

    cd sdk/python && python3 -m examples.equity_bot
"""

import random
import time

from poker_arena import (
    Bot,
    Request,
    ActResponse,
    call,
    check,
    deck_without,
    evaluate,
    fold,
    parse_cards,
    raise_to,
    serve,
)

#: Samples per decision. Standard error is about 0.5/sqrt(N) ~ 1.3% here.
ROLLOUTS = 1500
#: Never spend more than this on one decision, whatever the machine.
TIME_BUDGET_S = 1.5


def equity(hole: list[str], board: list[str], rollouts: int = ROLLOUTS) -> float:
    """Win probability against one uniformly random villain hand.

    Ties count as half a win.  A random range is a crude model of a real
    opponent — it overrates weak hands and underrates dominating ones — but it
    is unbiased and cheap.  PLUG IN: sample the villain's cards from a range
    that fits how they have been playing instead.

    Be aware of what the crude model does to this bot: against a *random* hand
    almost everything has enough raw equity to call the 3bb price heads-up, so
    it calls far too wide preflop and pays off too often against a bet that
    only a strong range would make.  Narrowing the sampled range — or bolting a
    preflop chart onto the front — is the single biggest win available here.
    """
    known = parse_cards(hole + board)
    deck = parse_cards(deck_without(hole + board))
    need = 5 - len(board)  # board cards still to come
    hero_hole, seen_board = known[:2], known[2:]

    wins = 0.0
    played = 0
    deadline = time.monotonic() + TIME_BUDGET_S
    for i in range(rollouts):
        # Checking the clock every 64 samples keeps the check itself off the
        # hot path while still stopping well inside the budget.
        if (i & 63) == 0 and time.monotonic() > deadline:
            break
        sample = random.sample(deck, 2 + need)
        villain_hole, runout = sample[:2], sample[2:]
        hero = evaluate(hero_hole + seen_board + runout).score
        villain = evaluate(villain_hole + seen_board + runout).score
        if hero > villain:
            wins += 1.0
        elif hero == villain:
            wins += 0.5
        played += 1

    return wins / played if played else 0.0


class EquityBot(Bot):
    name = "equity"

    def act(self, req: Request) -> ActResponse:
        eq = equity(req.hole_cards, req.board)

        if req.facing_bet:
            # req.pot_odds is exactly the equity that makes calling break even.
            if eq >= 0.72 and req.can_raise:
                return raise_to(req.raise_to_pot_fraction(0.75))  # value raise
            if eq > req.pot_odds + 0.03:  # margin covers the sampling error
                return call() if req.can_call else check()
            return fold() if req.can_fold else check()

        # Nothing to call: bet when we are ahead of a random hand often enough
        # to get called by worse, otherwise take the free card.
        if eq >= 0.62 and req.can_raise:
            size = 0.75 if eq >= 0.80 else 0.5
            return raise_to(req.raise_to_pot_fraction(size))
        return check() if req.can_check else call()


if __name__ == "__main__":
    serve(EquityBot(), port=8080)
