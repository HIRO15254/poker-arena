"""Card parsing and a correct 5-/7-card hand evaluator.

Cards are two-character strings: a rank from ``23456789TJQKA`` followed by a
suit from ``cdhs`` — ``"As"``, ``"Td"``, ``"7h"``.  That is exactly the format
the arena puts on the wire.

The evaluator returns a :class:`HandValue` whose ``score`` is a plain integer:
**bigger is better, equal means a tie**, across any two hands.  That is all a
bot ever needs::

    >>> from poker_arena.cards import evaluate
    >>> hero = evaluate(["As", "Ks", "Qs", "Js", "Ts"])
    >>> hero.name
    'Straight Flush'
    >>> hero.score > evaluate(["Ah", "Ad", "Ac", "As", "Kd"]).score
    True

The 7-card path is the straightforward one: best of ``C(7,5) = 21`` five-card
hands.  The wheel (``A-2-3-4-5``) is a five-high straight, as it should be.
"""

from __future__ import annotations

from itertools import combinations
from typing import Iterable, NamedTuple, Sequence

__all__ = [
    "RANKS",
    "SUITS",
    "RANK_TO_INT",
    "INT_TO_RANK",
    "DECK",
    "Card",
    "parse_card",
    "parse_cards",
    "rank_of",
    "suit_of",
    "deck_without",
    "HandValue",
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
    "evaluate",
    "evaluate5",
    "evaluate7",
    "best_five",
]

RANKS = "23456789TJQKA"
SUITS = "cdhs"

#: ``"2" -> 2 ... "T" -> 10, "J" -> 11, "Q" -> 12, "K" -> 13, "A" -> 14``
RANK_TO_INT: dict[str, int] = {ch: i + 2 for i, ch in enumerate(RANKS)}
INT_TO_RANK: dict[int, str] = {v: k for k, v in RANK_TO_INT.items()}


class Card(NamedTuple):
    """A parsed card. ``rank`` is 2..14 (ace high), ``suit`` is one of ``cdhs``."""

    rank: int
    suit: str

    def __str__(self) -> str:  # pragma: no cover - trivial
        return INT_TO_RANK[self.rank] + self.suit


#: All 52 cards as wire strings.
DECK: list[str] = [r + s for r in RANKS for s in SUITS]


def parse_card(card: str | Card) -> Card:
    """Parse ``"As"`` into ``Card(14, "s")``. Raises ``ValueError`` if malformed."""
    if isinstance(card, Card):
        return card
    text = card.strip()
    if len(text) != 2:
        raise ValueError(f"invalid card: {card!r}")
    rank_ch, suit_ch = text[0].upper(), text[1].lower()
    if rank_ch not in RANK_TO_INT or suit_ch not in SUITS:
        raise ValueError(f"invalid card: {card!r}")
    return Card(RANK_TO_INT[rank_ch], suit_ch)


def parse_cards(cards: Iterable[str | Card]) -> list[Card]:
    """Parse a sequence of cards."""
    return [parse_card(c) for c in cards]


def rank_of(card: str | Card) -> int:
    """Rank as an int, 2..14 (ace high)."""
    return parse_card(card).rank


def suit_of(card: str | Card) -> str:
    """Suit character, one of ``cdhs``."""
    return parse_card(card).suit


def deck_without(excluded: Iterable[str | Card]) -> list[str]:
    """The 52-card deck minus ``excluded`` (your hole cards + the board)."""
    dead = {str(parse_card(c)) for c in excluded}
    return [c for c in DECK if c not in dead]


# --- hand categories -------------------------------------------------------

HIGH_CARD = 0
PAIR = 1
TWO_PAIR = 2
THREE_OF_A_KIND = 3
STRAIGHT = 4
FLUSH = 5
FULL_HOUSE = 6
FOUR_OF_A_KIND = 7
STRAIGHT_FLUSH = 8

CATEGORY_NAMES: tuple[str, ...] = (
    "High Card",
    "Pair",
    "Two Pair",
    "Three of a Kind",
    "Straight",
    "Flush",
    "Full House",
    "Four of a Kind",
    "Straight Flush",
)


class HandValue(NamedTuple):
    """The value of a five-card hand.

    ``score`` is the only thing you need to compare hands: higher wins, equal
    ties.  ``category`` is one of the module constants, ``name`` its label, and
    ``ranks`` the tiebreak ranks in decreasing significance (zero-padded to 5).
    """

    score: int
    category: int
    name: str
    ranks: tuple[int, int, int, int, int]


def _pack(category: int, tiebreak: Sequence[int]) -> int:
    """Pack a category + up to 5 tiebreak ranks into one comparable int."""
    score = category
    for i in range(5):
        score = (score << 4) | (tiebreak[i] if i < len(tiebreak) else 0)
    return score


def _unpack(score: int) -> HandValue:
    category = score >> 20
    ranks = (
        (score >> 16) & 0xF,
        (score >> 12) & 0xF,
        (score >> 8) & 0xF,
        (score >> 4) & 0xF,
        score & 0xF,
    )
    return HandValue(score, category, CATEGORY_NAMES[category], ranks)


def _straight_high(ranks_desc: Sequence[int]) -> int:
    """Highest card of the straight formed by 5 ranks, or 0 if not a straight.

    The wheel ``A-5-4-3-2`` is a straight to the **five**.
    """
    uniq = sorted(set(ranks_desc), reverse=True)
    if len(uniq) != 5:
        return 0
    if uniq[0] - uniq[4] == 4:
        return uniq[0]
    if uniq == [14, 5, 4, 3, 2]:
        return 5
    return 0


def _score5(cards: Sequence[Card]) -> int:
    """Score exactly five parsed cards."""
    ranks = sorted((c.rank for c in cards), reverse=True)
    first_suit = cards[0].suit
    is_flush = all(c.suit == first_suit for c in cards)
    high = _straight_high(ranks)

    if is_flush and high:
        return _pack(STRAIGHT_FLUSH, (high,))

    counts: dict[int, int] = {}
    for r in ranks:
        counts[r] = counts.get(r, 0) + 1
    # Group ranks by count first, then by rank: quads/trips/pairs come first,
    # each already in the right tiebreak order.
    groups = sorted(counts.items(), key=lambda kv: (-kv[1], -kv[0]))
    shape = [n for _, n in groups]
    ordered = [r for r, _ in groups]

    if shape[0] == 4:
        return _pack(FOUR_OF_A_KIND, (ordered[0], ordered[1]))
    if shape[0] == 3 and shape[1] == 2:
        return _pack(FULL_HOUSE, (ordered[0], ordered[1]))
    if is_flush:
        return _pack(FLUSH, ranks)
    if high:
        return _pack(STRAIGHT, (high,))
    if shape[0] == 3:
        return _pack(THREE_OF_A_KIND, ordered[:3])
    if shape[0] == 2 and shape[1] == 2:
        return _pack(TWO_PAIR, ordered[:3])
    if shape[0] == 2:
        return _pack(PAIR, ordered[:4])
    return _pack(HIGH_CARD, ranks)


def evaluate5(cards: Sequence[str | Card]) -> HandValue:
    """Evaluate exactly five cards."""
    parsed = parse_cards(cards)
    if len(parsed) != 5:
        raise ValueError(f"evaluate5 needs 5 cards, got {len(parsed)}")
    return _unpack(_score5(parsed))


def evaluate7(cards: Sequence[str | Card]) -> HandValue:
    """Evaluate seven cards (2 hole + 5 board): the best of its 21 five-card hands."""
    parsed = parse_cards(cards)
    if len(parsed) != 7:
        raise ValueError(f"evaluate7 needs 7 cards, got {len(parsed)}")
    return _unpack(max(_score5(c) for c in combinations(parsed, 5)))


def evaluate(cards: Sequence[str | Card]) -> HandValue:
    """Evaluate 5, 6 or 7 cards: the best five-card hand available.

    This is the one to call from a bot — ``evaluate(req.hole_cards + req.board)``
    works on the flop (5), turn (6) and river (7) alike.
    """
    parsed = parse_cards(cards)
    n = len(parsed)
    if n == 5:
        return _unpack(_score5(parsed))
    if n in (6, 7):
        return _unpack(max(_score5(c) for c in combinations(parsed, 5)))
    raise ValueError(f"evaluate needs 5-7 cards, got {n}")


def best_five(cards: Sequence[str | Card]) -> tuple[str, ...]:
    """The best five-card hand out of 5-7 cards, as wire strings."""
    parsed = parse_cards(cards)
    if not 5 <= len(parsed) <= 7:
        raise ValueError(f"best_five needs 5-7 cards, got {len(parsed)}")
    best: tuple[Card, ...] = ()
    best_score = -1
    for combo in combinations(parsed, 5):
        score = _score5(combo)
        if score > best_score:
            best_score, best = score, combo
    return tuple(str(c) for c in best)
