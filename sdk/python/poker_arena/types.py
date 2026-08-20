"""Wire types for the Poker Arena bot protocol.

The arena speaks JSON over HTTP, so the types here are ``TypedDict``s that
mirror the wire format exactly: ``json.loads(body)`` already *is* an
``ActRequest``, and an ``ActResponse`` is a plain dict you can hand to
``json.dumps``.  No conversion layer, no surprises.

Every amount on the wire is an **integer number of chips**.  ``1bb = 100``
chips (:data:`CHIPS_PER_BB`).  Convert for display only.

Source of truth: ``packages/protocol/src/index.ts`` and
``packages/protocol/schema/act_request.schema.json``.
"""

from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

__all__ = [
    "CHIPS_PER_BB",
    "SMALL_BLIND",
    "BIG_BLIND",
    "STARTING_STACK",
    "Street",
    "PlayerStatus",
    "ActionKind",
    "Position",
    "PlayerState",
    "ActionRecord",
    "LegalAction",
    "ActRequest",
    "ActResponse",
    "to_bb",
    "to_chips",
    "fold",
    "check",
    "call",
    "raise_to",
]

#: Chips per big blind.  All wire amounts are integer chips.
CHIPS_PER_BB = 100

#: Season 1 blinds and stack depth (chips).
SMALL_BLIND = CHIPS_PER_BB // 2  # 50
BIG_BLIND = CHIPS_PER_BB  # 100
STARTING_STACK = 100 * CHIPS_PER_BB  # 10000 = 100bb, reset every hand

Street = Literal["preflop", "flop", "turn", "river"]
PlayerStatus = Literal["active", "folded", "allin"]
ActionKind = Literal[
    "post_sb", "post_bb", "fold", "check", "call", "bet", "raise"
]
#: Heads-up positions.  The button is the small blind.
Position = Literal["btn", "bb"]


class PlayerState(TypedDict):
    """A seat's state at the moment the request was built."""

    seat: int
    #: Chips behind (not yet in the pot).
    stack: int
    #: Chips this seat has put in **on the current street**.
    bet: int
    status: PlayerStatus


class ActionRecord(TypedDict):
    """One entry of the hand's action log, blinds included."""

    seat: int
    street: Street
    action: ActionKind
    #: The seat's **total** bet on that street after the action, never the
    #: increment: a call of 200 into a 300 bet is recorded as ``300``, and a
    #: ``bet``/``raise`` is the *raise to* total. Blinds record what was posted.
    amount: NotRequired[int]
    all_in: NotRequired[bool]
    #: True when the arena coerced a late/invalid response into check or fold.
    forced: NotRequired[bool]


class LegalAction(TypedDict):
    """One legal action.

    ``call`` carries ``amount`` (chips to add, already capped at your stack);
    ``raise`` carries ``min``/``max`` as *raise to* totals for the street.
    """

    action: Literal["fold", "check", "call", "raise"]
    amount: NotRequired[int]
    min: NotRequired[int]
    max: NotRequired[int]


class ActRequest(TypedDict):
    """Arena -> bot.  POSTed as the JSON body of the webhook call."""

    type: Literal["act"]
    hand_id: str
    #: Your seat index.
    seat: int
    hole_cards: list[str]
    board: list[str]
    street: Street
    #: Total pot **including** every chip committed so far this street.
    pot: int
    players: list[PlayerState]
    actions: list[ActionRecord]
    legal_actions: list[LegalAction]
    time_remaining_ms: NotRequired[int]
    time_bank_ms: NotRequired[int]


class ActResponse(TypedDict):
    """Bot -> arena.  ``amount`` is required for (and only for) ``raise``.

    ``amount`` is the *raise to* total for the street, not the increment.
    """

    action: Literal["fold", "check", "call", "raise"]
    amount: NotRequired[int]


def to_bb(chips: int) -> float:
    """Chips -> big blinds. ``to_bb(650) == 6.5``"""
    return chips / CHIPS_PER_BB


def to_chips(bb: float) -> int:
    """Big blinds -> chips (rounded to the nearest chip). ``to_chips(2.5) == 250``"""
    return int(round(bb * CHIPS_PER_BB))


# --- response constructors -------------------------------------------------


def fold() -> ActResponse:
    return {"action": "fold"}


def check() -> ActResponse:
    return {"action": "check"}


def call() -> ActResponse:
    return {"action": "call"}


def raise_to(amount: int) -> ActResponse:
    """Raise to ``amount`` chips total for this street (not the increment)."""
    return {"action": "raise", "amount": int(amount)}
