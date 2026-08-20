"""アップロード型 bot のコード長チェック(アリーナ側と同じ規則)。

    python3 -m poker_arena.upload mybot.py

規則は **`#` コメントと空行は無料、それ以外は全部数える**。
docstring を含む文字列リテラルは数える — 免除するとレンジ表を docstring に
置いて ``__doc__`` からパースする抜け道ができるため。長い説明は `#` で書く。

正の実装は TypeScript 側 (`packages/protocol/src/upload.ts`)。
このモジュールは同じ結果を返すように書かれている。
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

#: シーズン1の上限
MAX_CODE_BYTES = 8 * 1024
MAX_RAW_BYTES = 256 * 1024


@dataclass(frozen=True)
class Measurement:
    """計測結果。判定はすべてこの値で行われる。"""

    code_bytes: int
    raw_bytes: int
    code_lines: int

    @property
    def free_bytes(self) -> int:
        """数えられなかったバイト数(コメントと空行)。"""
        return self.raw_bytes - self.code_bytes

    @property
    def remaining(self) -> int:
        return MAX_CODE_BYTES - self.code_bytes


def strip_comments(source: str) -> str:
    """`#` コメントを落とす。文字列リテラルの中の `#` は残す。"""
    out: list[str] = []
    i = 0
    n = len(source)
    quote: str | None = None
    triple = False

    while i < n:
        c = source[i]
        if quote is None:
            if c == "#":
                while i < n and source[i] != "\n":
                    i += 1
                continue
            if c in "'\"":
                triple = source[i : i + 3] == c * 3
                quote = c
                length = 3 if triple else 1
                out.append(source[i : i + length])
                i += length
                continue
            out.append(c)
            i += 1
            continue

        # 文字列の中
        if c == "\\" and i + 1 < n:
            out.append(source[i : i + 2])
            i += 2
            continue
        if c == quote:
            if triple:
                if source[i : i + 3] == quote * 3:
                    out.append(source[i : i + 3])
                    i += 3
                    quote = None
                    triple = False
                    continue
            else:
                out.append(c)
                i += 1
                quote = None
                continue
        out.append(c)
        i += 1

    return "".join(out)


def measure_code(source: str) -> Measurement:
    """ソース文字列を計測する。"""
    raw_bytes = len(source.encode("utf-8"))
    lines = [ln for ln in strip_comments(source).split("\n") if ln.strip()]
    code_bytes = len("\n".join(lines).encode("utf-8"))
    return Measurement(code_bytes=code_bytes, raw_bytes=raw_bytes, code_lines=len(lines))


def check_upload(filename: str, source: str) -> tuple[bool, str, Measurement]:
    """(受理できるか, 理由, 計測結果) を返す。"""
    m = measure_code(source)
    if not filename.lower().endswith(".py"):
        return False, "提出できるのは .py ファイル 1 つだけです", m
    if m.code_lines == 0:
        return False, "コードが空です", m
    if m.raw_bytes > MAX_RAW_BYTES:
        return False, f"ファイルサイズが大きすぎます({m.raw_bytes} / 上限 {MAX_RAW_BYTES} バイト)", m
    if m.code_bytes > MAX_CODE_BYTES:
        return (
            False,
            f"コードが長すぎます({m.code_bytes} / 上限 {MAX_CODE_BYTES} バイト)。"
            "# コメントと空行は数えません",
            m,
        )
    return True, "OK", m


def _main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python3 -m poker_arena.upload <bot.py>", file=sys.stderr)
        return 2
    path = argv[1]
    with open(path, encoding="utf-8") as fh:
        source = fh.read()
    ok, reason, m = check_upload(path, source)
    bar_width = 40
    filled = min(bar_width, round(m.code_bytes / MAX_CODE_BYTES * bar_width))
    bar = "#" * filled + "." * (bar_width - filled)
    print(f"{path}")
    print(f"  [{bar}] {m.code_bytes} / {MAX_CODE_BYTES} バイト")
    print(f"  実コード {m.code_lines} 行 / 全体 {m.raw_bytes} バイト(コメント・空行 {m.free_bytes} バイトは無料)")
    if ok:
        print(f"  OK — あと {m.remaining} バイト使えます")
        return 0
    print(f"  NG — {reason}")
    return 1


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
