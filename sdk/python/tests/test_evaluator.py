"""Tests for the hand evaluator.

Runs under pytest::

    python3 -m pytest tests/ -q

or standalone, with no dependencies at all::

    python3 tests/test_evaluator.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from poker_arena.cards import (  # noqa: E402
    FLUSH,
    FOUR_OF_A_KIND,
    FULL_HOUSE,
    HIGH_CARD,
    PAIR,
    STRAIGHT,
    STRAIGHT_FLUSH,
    THREE_OF_A_KIND,
    TWO_PAIR,
    best_five,
    evaluate,
    evaluate5,
    evaluate7,
    parse_card,
    rank_of,
    suit_of,
)

# One example of every category, weakest first.
LADDER = [
    (["2c", "7d", "9h", "Jd", "Ks"], HIGH_CARD, "High Card"),
    (["2c", "2d", "9h", "Jd", "Ks"], PAIR, "Pair"),
    (["2c", "2d", "9h", "9d", "Ks"], TWO_PAIR, "Two Pair"),
    (["2c", "2d", "2h", "9d", "Ks"], THREE_OF_A_KIND, "Three of a Kind"),
    (["5c", "6d", "7h", "8d", "9s"], STRAIGHT, "Straight"),
    (["2c", "5c", "9c", "Jc", "Kc"], FLUSH, "Flush"),
    (["2c", "2d", "2h", "9d", "9s"], FULL_HOUSE, "Full House"),
    (["2c", "2d", "2h", "2s", "9s"], FOUR_OF_A_KIND, "Four of a Kind"),
    (["5c", "6c", "7c", "8c", "9c"], STRAIGHT_FLUSH, "Straight Flush"),
]


def test_parsing():
    assert parse_card("As") == (14, "s")
    assert parse_card("Td") == (10, "d")
    assert parse_card("7h") == (7, "h")
    assert rank_of("2c") == 2 and suit_of("2c") == "c"
    assert str(parse_card("Kd")) == "Kd"
    for bad in ("", "A", "Xs", "Ax", "10s", "AsKd"):
        try:
            parse_card(bad)
        except ValueError:
            continue
        raise AssertionError(f"{bad!r} should not parse")


def test_category_ordering():
    """Straight flush > quads > full house > flush > straight > trips > two pair > pair > high card."""
    scores = []
    for cards, category, name in LADDER:
        value = evaluate5(cards)
        assert value.category == category, (cards, value)
        assert value.name == name
        scores.append(value.score)
    assert scores == sorted(scores), scores
    assert len(set(scores)) == len(scores)


def test_wheel_straight():
    wheel = evaluate5(["Ad", "2c", "3h", "4s", "5d"])
    assert wheel.category == STRAIGHT
    assert wheel.ranks[0] == 5, "the wheel is a five-high straight"
    # ...and loses to every other straight, including six-high.
    assert wheel.score < evaluate5(["2c", "3h", "4s", "5d", "6c"]).score
    assert wheel.score > evaluate5(["Ad", "Kc", "Qh", "Js", "9d"]).score
    # A-K-Q-J-T is the best straight.
    assert evaluate5(["Ad", "Kc", "Qh", "Js", "Td"]).ranks[0] == 14
    # The wheel does not wrap: Q-K-A-2-3 is nothing.
    assert evaluate5(["Qd", "Kc", "Ah", "2s", "3d"]).category == HIGH_CARD


def test_steel_wheel():
    steel = evaluate5(["Ac", "2c", "3c", "4c", "5c"])
    assert steel.category == STRAIGHT_FLUSH and steel.ranks[0] == 5
    assert steel.score < evaluate5(["2c", "3c", "4c", "5c", "6c"]).score
    assert steel.score < evaluate5(["Tc", "Jc", "Qc", "Kc", "Ac"]).score
    assert steel.score > evaluate5(["Ac", "Ad", "Ah", "As", "Kc"]).score


def test_kickers():
    # High card: compared card by card.
    assert evaluate5(["Ac", "Kd", "9h", "5s", "3c"]).score > evaluate5(["Ac", "Qd", "Jh", "9s", "7c"]).score
    assert evaluate5(["Ac", "Kd", "9h", "5s", "3c"]).score > evaluate5(["Ac", "Kd", "9h", "5s", "2c"]).score
    # Pair: pair rank first, then kickers.
    assert evaluate5(["9c", "9d", "Ah", "5s", "3c"]).score > evaluate5(["8c", "8d", "Ah", "Ks", "Qc"]).score
    assert evaluate5(["9c", "9d", "Ah", "5s", "3c"]).score > evaluate5(["9h", "9s", "Kh", "5c", "3d"]).score
    # Two pair: top pair, bottom pair, then the kicker.
    assert evaluate5(["Kc", "Kd", "3h", "3s", "2c"]).score > evaluate5(["Qc", "Qd", "Jh", "Js", "Ac"]).score
    assert evaluate5(["Kc", "Kd", "9h", "9s", "Ac"]).score > evaluate5(["Kh", "Ks", "9c", "9d", "Qc"]).score
    # Trips and quads: the kicker settles it.
    assert evaluate5(["7c", "7d", "7h", "Ks", "2c"]).score > evaluate5(["7c", "7d", "7h", "Qs", "Jc"]).score
    assert evaluate5(["4c", "4d", "4h", "4s", "Kc"]).score > evaluate5(["4c", "4d", "4h", "4s", "Qc"]).score
    # Full house: trips rank dominates the pair rank.
    assert evaluate5(["3c", "3d", "3h", "2s", "2c"]).score > evaluate5(["2d", "2h", "2s", "Ac", "Ad"]).score
    # Flush: compared like a high card hand.
    assert evaluate5(["Ac", "Jc", "9c", "5c", "3c"]).score > evaluate5(["Kc", "Qc", "Jc", "9c", "7c"]).score
    assert evaluate5(["Ac", "Jc", "9c", "5c", "4c"]).score > evaluate5(["Ad", "Jd", "9d", "5d", "3d"]).score


def test_ties_are_equal_scores():
    # Same hand, different suits.
    assert evaluate5(["Ac", "Kd", "9h", "5s", "3c"]).score == evaluate5(["Ah", "Ks", "9d", "5c", "3h"]).score
    assert evaluate5(["Ac", "2c", "3c", "4c", "5c"]).score == evaluate5(["Ah", "2h", "3h", "4h", "5h"]).score
    # Equal scores mean the whole HandValue is equal, so `==` is safe too.
    assert evaluate5(["Qc", "Qd", "7h", "7s", "2c"]) == evaluate5(["Qh", "Qs", "7c", "7d", "2d"])
    # Playing the board: both players hold the same five cards.
    board = ["Ah", "Kh", "Qh", "Jh", "Th"]
    assert evaluate7(board + ["2c", "3d"]).score == evaluate7(board + ["7s", "8s"]).score


def test_seven_cards():
    # Two pair on board plus a bigger pair in hand -> the hole cards play.
    value = evaluate7(["As", "Ad", "Kc", "Kd", "7h", "3s", "2c"])
    assert value.name == "Two Pair" and value.ranks[:3] == (14, 13, 7)

    # Flush must beat the straight available on the same seven cards.
    value = evaluate7(["9c", "8c", "7c", "6c", "5d", "2h", "Kc"])
    assert value.category == FLUSH
    assert set(best_five(["9c", "8c", "7c", "6c", "5d", "2h", "Kc"])) == {"Kc", "9c", "8c", "7c", "6c"}

    # Wheel made from seven cards, with the ace at the far end.
    value = evaluate7(["Ah", "2d", "3c", "4s", "5h", "Kd", "Qc"])
    assert value.category == STRAIGHT and value.ranks[0] == 5

    # Quads on the board, kicker from the hand.
    value = evaluate7(["6c", "6d", "6h", "6s", "2c", "As", "3d"])
    assert value.category == FOUR_OF_A_KIND and value.ranks == (6, 14, 0, 0, 0)

    # Full house beats a flush draw that never came in.
    hero = evaluate7(["Jd", "Js", "Jh", "9c", "9d", "2c", "4c"])
    villain = evaluate7(["Ac", "Kc", "Jh", "9c", "9d", "2c", "4c"])
    assert hero.category == FULL_HOUSE and hero.score > villain.score

    # Straight flush on seven cards outranks quads on the same board.
    value = evaluate7(["7h", "8h", "9h", "Th", "Jh", "Jd", "Js"])
    assert value.category == STRAIGHT_FLUSH and value.ranks[0] == 11


def test_evaluate_accepts_five_to_seven():
    flop = ["As", "Kd", "Qc", "Jh", "Ts"]
    assert evaluate(flop).category == STRAIGHT
    assert evaluate(flop + ["2c"]).category == STRAIGHT
    assert evaluate(flop + ["2c", "3d"]).category == STRAIGHT
    for bad in (flop[:4], flop + ["2c", "3d", "4h"]):
        try:
            evaluate(bad)
        except ValueError:
            continue
        raise AssertionError("evaluate should reject that card count")


def test_evaluate7_matches_brute_force():
    """The 7-card path must equal the best of its own 21 five-card hands."""
    import itertools
    import random

    from poker_arena.cards import DECK

    rng = random.Random(20260820)
    for _ in range(300):
        cards = rng.sample(DECK, 7)
        expected = max(evaluate5(list(combo)).score for combo in itertools.combinations(cards, 5))
        assert evaluate7(cards).score == expected
        assert evaluate5(list(best_five(cards))).score == expected


def _main() -> int:
    tests = [(n, o) for n, o in sorted(globals().items()) if n.startswith("test_") and callable(o)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {name}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_main())
