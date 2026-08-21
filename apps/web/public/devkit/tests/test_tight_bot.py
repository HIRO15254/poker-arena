"""Behavioural tests for the tight_bot example.

Runs under pytest::

    python3 -m pytest tests/ -q

or standalone::

    python3 tests/test_tight_bot.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from examples.tight_bot import TightBot, board_strength  # noqa: E402
from poker_arena.bot import Request  # noqa: E402


def make_request(
    *,
    hole,
    board,
    street,
    pot,
    legal_actions,
    hero_bet=0,
    villain_bet=0,
    hero_stack=9000,
    villain_stack=9000,
    actions=None,
):
    """Build an ActRequest for seat 0 (hero) in a heads-up hand."""
    return Request(
        {
            "type": "act",
            "hand_id": "h_test",
            "seat": 0,
            "hole_cards": hole,
            "board": board,
            "street": street,
            "pot": pot,
            "players": [
                {"seat": 0, "stack": hero_stack, "bet": hero_bet, "status": "active"},
                {
                    "seat": 1,
                    "stack": villain_stack,
                    "bet": villain_bet,
                    "status": "allin" if villain_stack == 0 else "active",
                },
            ],
            "actions": actions if actions is not None else [],
            "legal_actions": legal_actions,
        }
    )


def test_set_calls_an_all_in_when_raising_is_illegal():
    """A set must never fold to an all-in just because no raise is legal.

    When the opponent is all in there is no `raise` in `legal_actions`; an
    earlier version fell through the raise branch straight into `fold()`.
    """
    req = make_request(
        hole=["7c", "7d"],
        board=["7h", "Ks", "2d"],
        street="flop",
        pot=8000,
        hero_bet=0,
        villain_bet=4000,
        villain_stack=0,
        legal_actions=[{"action": "fold"}, {"action": "call", "amount": 4000}],
    )
    assert board_strength(req) == 4, "trips should rate as MONSTER"
    assert TightBot().act(req) == {"action": "call"}


def test_two_pair_calls_an_all_in_when_raising_is_illegal():
    req = make_request(
        hole=["Kc", "2c"],
        board=["Kd", "2h", "9s"],
        street="turn",
        pot=6000,
        villain_bet=3000,
        villain_stack=0,
        legal_actions=[{"action": "fold"}, {"action": "call", "amount": 3000}],
    )
    assert board_strength(req) == 3, "two pair"
    assert TightBot().act(req) == {"action": "call"}


def test_set_raises_when_a_raise_is_legal():
    req = make_request(
        hole=["7c", "7d"],
        board=["7h", "Ks", "2d"],
        street="flop",
        pot=8000,
        villain_bet=4000,
        legal_actions=[
            {"action": "fold"},
            {"action": "call", "amount": 4000},
            {"action": "raise", "min": 8000, "max": 9000},
        ],
    )
    res = TightBot().act(req)
    assert res["action"] == "raise"
    assert 8000 <= res["amount"] <= 9000


def test_air_folds_to_a_bet():
    req = make_request(
        hole=["7c", "3d"],
        board=["Ah", "Ks", "Qd"],
        street="flop",
        pot=400,
        villain_bet=200,
        legal_actions=[{"action": "fold"}, {"action": "call", "amount": 200}],
    )
    assert board_strength(req) == 0
    assert TightBot().act(req) == {"action": "fold"}


def test_never_returns_an_illegal_action():
    """Whatever it decides must be present in legal_actions."""
    cases = [
        (["As", "Ks"], ["2c", "7d", "9h"], "flop"),
        (["Ac", "Ad"], ["Ah", "Kd", "2s"], "flop"),
        (["3c", "4d"], ["Ah", "Kd", "Qs", "Jc", "2h"], "river"),
        (["Tc", "Td"], ["9h", "8d", "2s", "Th"], "turn"),
    ]
    legal_sets = [
        [{"action": "fold"}, {"action": "call", "amount": 300}],
        [{"action": "check"}, {"action": "raise", "min": 200, "max": 9000}],
        [{"action": "check"}],
        [{"action": "fold"}, {"action": "call", "amount": 900}, {"action": "raise", "min": 1800, "max": 9000}],
    ]
    bot = TightBot()
    for hole, board, street in cases:
        for legal in legal_sets:
            req = make_request(
                hole=hole,
                board=board,
                street=street,
                pot=1200,
                villain_bet=300 if any(a["action"] == "call" for a in legal) else 0,
                legal_actions=legal,
            )
            res = bot.act(req)
            allowed = {a["action"] for a in legal}
            assert res["action"] in allowed, f"{res} not in {allowed} for {hole} {board}"


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as exc:
                failures += 1
                print(f"FAIL {name}: {exc}")
    total = len([n for n in globals() if n.startswith("test_")])
    print(f"\n{total - failures}/{total} passed")
    sys.exit(1 if failures else 0)
