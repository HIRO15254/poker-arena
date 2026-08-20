"""Poker Arena Python SDK — write a heads-up No-Limit Hold'em bot.

Everything you need is exported here::

    from poker_arena import Bot, Request, ActResponse, call, check, raise_to, serve

    class MyBot(Bot):
        def act(self, req: Request) -> ActResponse:
            if req.can_raise and req.hand and req.hand.category >= 1:
                return raise_to(req.raise_to_pot_fraction(0.66))
            return check() if req.can_check else call()

    if __name__ == "__main__":
        serve(MyBot(), port=8080)

Stdlib only, Python 3.11+.
"""

from .bot import Bot, BotLike, Request, as_callable
from .cards import (
    CATEGORY_NAMES,
    DECK,
    FLUSH,
    FOUR_OF_A_KIND,
    FULL_HOUSE,
    HIGH_CARD,
    PAIR,
    STRAIGHT,
    STRAIGHT_FLUSH,
    THREE_OF_A_KIND,
    TWO_PAIR,
    Card,
    HandValue,
    best_five,
    deck_without,
    evaluate,
    evaluate5,
    evaluate7,
    parse_card,
    parse_cards,
    rank_of,
    suit_of,
)
from .server import (
    handle_request,
    normalize_response,
    serve,
    sign_body,
    verify_signature,
)
from .types import (
    BIG_BLIND,
    CHIPS_PER_BB,
    SMALL_BLIND,
    STARTING_STACK,
    ActionKind,
    ActionRecord,
    ActRequest,
    ActResponse,
    LegalAction,
    PlayerState,
    PlayerStatus,
    Position,
    Street,
    call,
    check,
    fold,
    raise_to,
    to_bb,
    to_chips,
)

__version__ = "0.1.0"

__all__ = [
    "__version__",
    # bot
    "Bot",
    "BotLike",
    "Request",
    "as_callable",
    # types
    "ActRequest",
    "ActResponse",
    "ActionKind",
    "ActionRecord",
    "LegalAction",
    "PlayerState",
    "PlayerStatus",
    "Position",
    "Street",
    "CHIPS_PER_BB",
    "SMALL_BLIND",
    "BIG_BLIND",
    "STARTING_STACK",
    "to_bb",
    "to_chips",
    "fold",
    "check",
    "call",
    "raise_to",
    # cards
    "Card",
    "HandValue",
    "DECK",
    "CATEGORY_NAMES",
    "HIGH_CARD",
    "PAIR",
    "TWO_PAIR",
    "THREE_OF_A_KIND",
    "STRAIGHT",
    "FLUSH",
    "FULL_HOUSE",
    "FOUR_OF_A_KIND",
    "STRAIGHT_FLUSH",
    "parse_card",
    "parse_cards",
    "rank_of",
    "suit_of",
    "deck_without",
    "evaluate",
    "evaluate5",
    "evaluate7",
    "best_five",
    # server
    "serve",
    "handle_request",
    "normalize_response",
    "sign_body",
    "verify_signature",
]
