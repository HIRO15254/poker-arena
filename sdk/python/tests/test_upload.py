"""コード長チェックのテスト。TypeScript 実装と同じ結果になることを前提にしている。

    python3 tests/test_upload.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from poker_arena.upload import (  # noqa: E402
    MAX_CODE_BYTES,
    check_upload,
    measure_code,
    strip_comments,
)


def test_comments_are_free():
    base = "def act(req):\n    return {'action': 'fold'}\n"
    documented = "# " + "解説" * 500 + "\n" + base
    assert measure_code(documented).code_bytes == measure_code(base).code_bytes
    assert measure_code(documented).raw_bytes > measure_code(base).raw_bytes


def test_blank_lines_are_free():
    assert measure_code("x = 1\n\n\n\n").code_bytes == measure_code("x = 1\n").code_bytes
    assert measure_code("# only a comment\n\n").code_lines == 0


def test_hash_inside_strings_is_not_a_comment():
    assert strip_comments("s = '# not a comment'") == "s = '# not a comment'"
    assert strip_comments('s = "# not a comment"') == 's = "# not a comment"'
    triple = 's = """\n# still a string\n"""\n'
    assert strip_comments(triple) == triple


def test_escaped_quote_does_not_end_string():
    src = "s = 'it\\'s # fine'  # real comment"
    out = strip_comments(src)
    assert "it\\'s # fine" in out
    assert "real comment" not in out


def test_comment_after_string_is_stripped():
    assert strip_comments("s = 'a'  # comment").strip() == "s = 'a'"


def test_docstrings_are_counted():
    with_doc = measure_code('def f():\n    """説明"""\n    return 1\n')
    without = measure_code("def f():\n    return 1\n")
    assert with_doc.code_bytes > without.code_bytes


def test_hiding_a_table_in_a_docstring_is_rejected():
    table = "AA:1.0,KK:1.0," * 1000
    ok, _reason, _m = check_upload("bot.py", f'RANGES = """{table}"""\n')
    assert ok is False


def test_boundary():
    # "x=1" 行を n 本繋ぐと code_bytes は 4n-1
    at_limit = "x=1\n" * 2048
    assert measure_code(at_limit).code_bytes == 8191
    assert check_upload("bot.py", at_limit)[0] is True

    over = "x=1\n" * 2049
    assert measure_code(over).code_bytes == 8195
    ok, reason, _ = check_upload("bot.py", over)
    assert ok is False
    assert "長すぎます" in reason


def test_rejects_non_python_and_empty():
    assert check_upload("bot.txt", "x = 1\n")[0] is False
    assert check_upload("bot.py", "\n\n# comment only\n")[0] is False


def test_season_one_limit():
    assert MAX_CODE_BYTES == 8 * 1024


def test_bundled_examples_fit():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for name in ("always_call.py", "tight_bot.py", "equity_bot.py"):
        path = os.path.join(here, "examples", name)
        with open(path, encoding="utf-8") as fh:
            ok, reason, m = check_upload(path, fh.read())
        assert ok, f"{name}: {reason} ({m.code_bytes} bytes)"


if __name__ == "__main__":
    failures = 0
    tests = sorted(n for n in dir() if n.startswith("test_"))
    for name in tests:
        try:
            globals()[name]()
            print(f"PASS {name}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL {name}: {exc}")
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    sys.exit(1 if failures else 0)
