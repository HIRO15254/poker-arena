"""A readable heads-up strategy: raise strong holdings, c-bet when connected, fold otherwise.

Not a solver — a skeleton with every decision in one place so you can swap
pieces out.  The three knobs worth turning first are marked ``PLUG IN``:

1. :func:`preflop_class`  — which hands you play, and from which position.
2. :func:`board_strength` — how you rate your hand once cards are out.
3. :meth:`TightBot.act`   — the sizing and thresholds that glue them together.

Run it:

    cd sdk/python && python3 -m examples.tight_bot
"""

from poker_arena import (
    Bot,
    evaluate,
    Request,
    ActResponse,
    CHIPS_PER_BB,
    PAIR,
    THREE_OF_A_KIND,
    TWO_PAIR,
    call,
    check,
    fold,
    parse_cards,
    raise_to,
    serve,
)

# Hand classes, weakest to strongest.
TRASH, PLAYABLE, STRONG, PREMIUM = 0, 1, 2, 3


def preflop_class(hole: list[str]) -> int:
    """Rate two hole cards. PLUG IN: this is your preflop range.

    Heads-up ranges are wide. You post a blind every single hand, so folding
    the button costs `0.5bb` and folding the big blind costs `1bb` — a range
    that would be reasonable at a full table bleeds chips here. This one opens
    roughly the top 70% from the button and only throws away offsuit junk.
    """
    a, b = parse_cards(hole)
    hi, lo = max(a.rank, b.rank), min(a.rank, b.rank)
    suited = a.suit == b.suit
    gap = hi - lo

    if hi == lo:  # pocket pair
        return PREMIUM if hi >= 10 else STRONG  # TT+ / 22-99

    if suited:
        if hi == 14:
            return PREMIUM if lo >= 11 else STRONG  # AJs+ / A2s-ATs
        if lo >= 10:
            return STRONG  # KQs KJs KTs QJs QTs JTs
        if gap <= 2 and lo >= 5:
            return STRONG  # suited connectors and one-gappers
        return PLAYABLE  # any other suited hand plays fine heads-up

    # offsuit
    if hi == 14:
        if lo >= 12:
            return PREMIUM  # AK AQ
        return STRONG if lo >= 11 else PLAYABLE  # AJ / any other ace
    if lo >= 11:
        return STRONG  # KQ KJ QJ
    if hi >= 12 and lo >= 8:
        return PLAYABLE  # K/Q with a real kicker
    if gap <= 2 and lo >= 6:
        return PLAYABLE  # offsuit connectors, 76o+
    if hi >= 11 and lo >= 6:
        return PLAYABLE  # J/K/Q high, playable in position
    return TRASH  # 92o and friends


def _straight_outs(ranks: set[int]) -> int:
    """How many ranks would complete a straight (2+ ~ open-ended, 1 ~ gutshot)."""
    windows = [tuple(range(a, a + 5)) for a in range(2, 11)] + [(14, 2, 3, 4, 5)]
    outs = 0
    for r in range(2, 15):
        if r in ranks:
            continue
        filled = ranks | {r}
        if any(all(x in filled for x in w) for w in windows):
            outs += 1
    return outs


def board_strength(req: Request) -> int:
    """Rate your hand against the board, 0-4. PLUG IN: your postflop hand reading.

    * 4 — trips or better: worth getting all the chips in
    * 3 — two pair: worth betting, not worth a `100bb` raising war
    * 2 — top pair or an overpair
    * 1 — a weaker pair, or a flush/straight draw with cards still to come
    * 0 — nothing

    The two traps this avoids: counting a hand the *board* makes (both players
    hold it, so it is worth nothing), and counting a draw on the river (there
    are no more cards — a missed draw is just high card).
    """
    made = req.hand
    if made is None:  # preflop
        return 0

    hole = parse_cards(req.hole_cards)
    board = parse_cards(req.board)
    top_board = max(c.rank for c in board)
    river = len(board) == 5

    if made.category >= TWO_PAIR:
        # Does the board make it by itself? Then both of us have it.
        if river and evaluate(req.board).score == made.score:
            return 0
        return 4 if made.category >= THREE_OF_A_KIND else 3

    if made.category == PAIR:
        pair_rank = made.ranks[0]
        ours = any(c.rank == pair_rank for c in hole)
        # Top pair (paired the highest board card) or an overpair to the board.
        if ours and pair_rank >= top_board:
            return 2
        return 1 if ours else 0  # a pair on the board alone is worth nothing

    # No made hand. Draws only count while there are cards left to come.
    if not river:
        for suit in "cdhs":
            if sum(c.suit == suit for c in hole + board) == 4 and any(c.suit == suit for c in hole):
                return 1  # flush draw
        if _straight_outs({c.rank for c in hole + board}) >= 2:
            return 1  # open-ended straight draw
    return 0


def _preflop_raiser(req: Request) -> int | None:
    """Seat of the last preflop raiser, or None in a limped pot."""
    seat = None
    for a in req.actions:
        if a["street"] == "preflop" and a["action"] in ("bet", "raise"):
            seat = a["seat"]
    return seat


def _preflop_raises(req: Request) -> int:
    """How many raises have gone in preflop. `1` = an open, `2` = a 3-bet."""
    return sum(
        1 for a in req.actions
        if a["street"] == "preflop" and a["action"] in ("bet", "raise")
    )


class TightBot(Bot):
    name = "tight"

    def act(self, req: Request) -> ActResponse:
        if req.is_preflop:
            return self.preflop(req)
        return self.postflop(req)

    # --- preflop -----------------------------------------------------------

    def preflop(self, req: Request) -> ActResponse:
        strength = preflop_class(req.hole_cards)
        raises = _preflop_raises(req)

        if raises == 0:
            # No raise yet: open from the button, or raise a limp from the BB.
            if strength >= PLAYABLE and req.can_raise:
                return raise_to(req.raise_to_pot_fraction(1.0))  # ~3bb heads-up
            return check() if req.can_check else fold()

        if raises == 1:
            # Facing an open: 3-bet the top, call the middle, fold the rest.
            if strength == PREMIUM and req.can_raise:
                return raise_to(req.raise_to_pot_fraction(0.75))
            if strength >= STRONG:
                return call() if req.can_call else check()
            # Cheap calls only: never more than 3bb to see a flop with a weak hand.
            if strength == PLAYABLE and req.to_call <= 3 * CHIPS_PER_BB and req.can_call:
                return call()
            return check() if req.can_check else fold()

        # Facing a 3-bet or more. Do NOT re-raise here: escalating with a
        # 4-tier range means getting 100bb in with hands that are behind the
        # range that keeps raising. Call the top, fold everything else.
        if strength == PREMIUM:
            return call() if req.can_call else check()
        return check() if req.can_check else fold()

    # --- postflop ----------------------------------------------------------

    def postflop(self, req: Request) -> ActResponse:
        strength = board_strength(req)
        was_aggressor = _preflop_raiser(req) == req.seat
        flop = req.street == "flop"
        river = req.street == "river"

        if not req.facing_bet:
            # Nobody has bet. Value-bet what is worth value, fire one
            # continuation bet with the rest, and take the free card otherwise.
            if req.can_raise:
                if strength >= 4:
                    return raise_to(req.raise_to_pot_fraction(0.75))
                if strength == 3:
                    return raise_to(req.raise_to_pot_fraction(0.66))
                if strength == 2:
                    return raise_to(req.raise_to_pot_fraction(0.5))
                if was_aggressor and strength == 1 and flop:
                    return raise_to(req.raise_to_pot_fraction(0.5))
            return check()

        # Facing a bet. Note the `can_raise` guard: when the opponent is all in
        # there is no legal raise, and a strong hand must fall through to a
        # call, never to a fold.
        if strength >= 4:
            if req.can_raise:
                return raise_to(req.raise_to_pot_fraction(0.75))
            return call() if req.can_call else check()
        if strength == 3:
            # Two pair is worth a raise on the flop, when the pot is still
            # small. Later streets it only calls: a raising war for `100bb`
            # with two pair is a war you win far too rarely.
            if flop and req.can_raise:
                return raise_to(req.raise_to_pot_fraction(0.75))
            return call() if req.can_call else check()
        if strength == 2 and req.pot_odds <= 0.45 and req.can_call:
            return call()  # top pair calls a normal bet, not an overbet
        if strength == 1 and req.can_call:
            # A draw is worth a price while cards are still to come; on the
            # river a weak pair is only ever a cheap bluff-catcher.
            price = 0.2 if river else 0.35
            if req.pot_odds <= price:
                return call()
        return fold() if req.can_fold else check()


if __name__ == "__main__":
    serve(TightBot(), port=8080)
