#!/usr/bin/env python3
"""提出前にコード長を確認する。

    python3 check_bot.py mybot.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poker_arena.upload import _main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
