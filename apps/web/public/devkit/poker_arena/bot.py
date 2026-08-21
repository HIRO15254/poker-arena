"""The :class:`Bot` base class and the :class:`Request` wrapper.

A bot is one method::

    from poker_arena import Bot, Request, ActResponse, call, check

    class MyBot(Bot):
        def act(self, req: Request) -> ActResponse:
            return check() if req.can_check else call()

:class:`Request` wraps the raw :class:`~poker_arena.types.ActRequest` dict and
adds the arithmetic every heads-up bot ends up writing anyway — chips to call,
pot odds, legal raise bounds, pot-fraction sizing.  The raw dict is always
available as ``req.raw``.
"""

from __future__ import annotations

from functools import cached_property
from typing import Callable, Union

from .cards import HandValue, evaluate
from .types import (
    ActRequest,
    ActResponse,
    ActionRecord,
    LegalAction,
    PlayerState,
    Position,
    Street,
    check,
    fold,
    to_bb,
)

__all__ = ["Request", "Bot", "BotLike", "as_callable"]


class Request:
    """Convenience view over one :class:`~poker_arena.types.ActRequest`.

    All amounts are chips.  Nothing here mutates the request; every property is
    derived from ``raw``.
    """

    def __init__(self, raw: ActRequest) -> None:
        #: The decoded JSON body exactly as the arena sent it.
        self.raw = raw

    # --- straight pass-throughs -------------------------------------------

    @property
    def hand_id(self) -> str:
        return self.raw["hand_id"]

    @property
    def seat(self) -> int:
        """Your seat index."""
        return self.raw["seat"]

    @property
    def hole_cards(self) -> list[str]:
        return self.raw["hole_cards"]

    @property
    def board(self) -> list[str]:
        """Community cards: 0 preflop, 3 on the flop, 4 turn, 5 river."""
        return self.raw["board"]

    @property
    def street(self) -> Street:
        return self.raw["street"]

    @property
    def pot(self) -> int:
        """Total pot in chips, **including** every chip committed this street."""
        return self.raw["pot"]

    @property
    def players(self) -> list[PlayerState]:
        return self.raw["players"]

    @property
    def actions(self) -> list[ActionRecord]:
        """Every action of this hand so far, blinds included."""
        return self.raw["actions"]

    @property
    def legal_actions(self) -> list[LegalAction]:
        return self.raw["legal_actions"]

    @property
    def time_remaining_ms(self) -> int:
        """Milliseconds left on the base clock (5s for webhook bots).

        Optional on the wire — ``0`` when the arena does not send it, so keep
        your own time budget rather than relying on this.
        """
        return self.raw.get("time_remaining_ms", 0)

    @property
    def time_bank_ms(self) -> int:
        """Milliseconds left in the time bank, spent only after the base clock."""
        return self.raw.get("time_bank_ms", 0)

    # --- seats -------------------------------------------------------------

    @cached_property
    def hero(self) -> PlayerState:
        """Your own seat state."""
        for p in self.players:
            if p["seat"] == self.seat:
                return p
        raise ValueError(f"seat {self.seat} not present in players")

    @cached_property
    def villain(self) -> PlayerState:
        """The opponent (heads-up: the other seat)."""
        others = [p for p in self.players if p["seat"] != self.seat]
        if not others:
            raise ValueError("no opponent in players")
        for p in others:
            if p["status"] != "folded":
                return p
        return others[0]

    @property
    def stack(self) -> int:
        """Your chips behind (not counting what you already put in)."""
        return self.hero["stack"]

    @property
    def my_bet(self) -> int:
        """Chips you have already put in **on this street**."""
        return self.hero["bet"]

    @property
    def effective_stack(self) -> int:
        """The smaller of the two remaining stacks — what can actually be won."""
        return min(self.hero["stack"] + self.hero["bet"], self.villain["stack"] + self.villain["bet"])

    @cached_property
    def button_seat(self) -> int:
        """The button's seat. Heads-up the button posts the small blind."""
        for a in self.actions:
            if a["action"] == "post_sb":
                return a["seat"]
        # Should never happen: the blinds are always in the action log.
        return self.seat

    @property
    def position(self) -> Position:
        """``"btn"`` (button = small blind) or ``"bb"``.

        Heads-up the button acts **first** preflop and **last** postflop.
        """
        return "btn" if self.seat == self.button_seat else "bb"

    # --- legal actions -----------------------------------------------------

    def legal(self, action: str) -> LegalAction | None:
        """The ``LegalAction`` entry for ``action``, or ``None`` if not allowed."""
        for la in self.legal_actions:
            if la["action"] == action:
                return la
        return None

    @property
    def can_fold(self) -> bool:
        return self.legal("fold") is not None

    @property
    def can_check(self) -> bool:
        return self.legal("check") is not None

    @property
    def can_call(self) -> bool:
        return self.legal("call") is not None

    @property
    def can_raise(self) -> bool:
        """True when raising (or betting) is legal — always check this before sizing."""
        return self.legal("raise") is not None

    @property
    def to_call(self) -> int:
        """Chips you must add to call. ``0`` when you can check.

        Already capped at your stack, so calling never exceeds it.
        """
        la = self.legal("call")
        return int(la["amount"]) if la and "amount" in la else 0

    @property
    def facing_bet(self) -> bool:
        """True when there is a live bet in front of you."""
        return self.to_call > 0

    @property
    def min_raise(self) -> int:
        """Smallest legal *raise to* total for this street (0 if raising is illegal)."""
        la = self.legal("raise")
        return int(la["min"]) if la and "min" in la else 0

    @property
    def max_raise(self) -> int:
        """Largest legal *raise to* total — your all-in (0 if raising is illegal)."""
        la = self.legal("raise")
        return int(la["max"]) if la and "max" in la else 0

    # --- derived numbers ---------------------------------------------------

    @property
    def pot_odds(self) -> float:
        """``to_call / (pot after your call)`` — the equity you need to break even.

        ``0.0`` when nothing is owed.  Compare it against your estimated equity:
        call when ``equity > req.pot_odds``.
        """
        to_call = self.to_call
        if to_call <= 0:
            return 0.0
        return to_call / (self.pot + to_call)

    def raise_to_pot_fraction(self, fraction: float) -> int:
        """A *raise to* amount sizing the raise at ``fraction`` of the pot.

        ``fraction=1.0`` is a pot-sized bet/raise: you call first, then put in
        the resulting pot on top.  The result is clamped into the legal
        ``[min_raise, max_raise]`` range, so it is always a legal amount.

        Raises ``ValueError`` when raising is not legal — guard with
        :attr:`can_raise` first.
        """
        la = self.legal("raise")
        if la is None:
            raise ValueError("raising is not legal in this spot")
        to_call = self.to_call
        pot_after_call = self.pot + to_call
        target = self.my_bet + to_call + int(round(fraction * pot_after_call))
        lo, hi = int(la["min"]), int(la["max"])
        return max(lo, min(hi, target))

    @cached_property
    def hand(self) -> HandValue | None:
        """Your best five-card hand, or ``None`` preflop (fewer than 5 cards)."""
        cards = list(self.hole_cards) + list(self.board)
        if len(cards) < 5:
            return None
        return evaluate(cards)

    def actions_on(self, street: Street) -> list[ActionRecord]:
        """Actions taken on one street."""
        return [a for a in self.actions if a["street"] == street]

    @property
    def is_preflop(self) -> bool:
        return self.street == "preflop"

    def fallback(self) -> ActResponse:
        """The arena's own coercion rule: check when legal, otherwise fold.

        Use it as the safe answer whenever your strategy code cannot decide.
        """
        return check() if self.can_check else fold()

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return (
            f"<Request {self.street} hole={' '.join(self.hole_cards)} "
            f"board={' '.join(self.board) or '-'} pot={to_bb(self.pot):.1f}bb "
            f"to_call={to_bb(self.to_call):.1f}bb pos={self.position}>"
        )


class Bot:
    """Base class for a bot. Override :meth:`act`.

    ``act`` must return an :class:`~poker_arena.types.ActResponse` within the
    time limit (5s + time bank for webhook bots).  Anything late, invalid or
    raised is coerced by the arena to check-if-legal-otherwise-fold.
    """

    #: Shown in local logs only; the arena uses the name you registered.
    name: str = "bot"

    def act(self, req: Request) -> ActResponse:
        raise NotImplementedError("override act()")

    def __call__(self, req: Request) -> ActResponse:
        return self.act(req)


#: Anything ``serve()`` accepts: a :class:`Bot` or a plain callable.
BotLike = Union[Bot, Callable[[Request], ActResponse]]


def as_callable(bot: BotLike) -> Callable[[Request], ActResponse]:
    """Normalise a :class:`Bot` or a bare function into a callable."""
    if isinstance(bot, Bot):
        return bot.act
    if callable(bot):
        return bot
    raise TypeError("bot must be a Bot instance or a callable taking a Request")
