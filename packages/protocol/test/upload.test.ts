import { describe, expect, it } from "vitest";
import {
  DEFAULT_UPLOAD_LIMITS,
  checkBotUpload,
  measurePythonCode,
  stripPythonComments,
} from "../src/index.js";

const measure = (src: string) => measurePythonCode(src);

describe("コメントと空行を数えない", () => {
  it("# コメントは無料", () => {
    const withComment = measure("x = 1  # これは説明\n");
    const without = measure("x = 1\n");
    expect(withComment.codeBytes).toBe(without.codeBytes + 2); // 末尾の空白2つが残る
    expect(withComment.freeBytes).toBeGreaterThan(0);
  });

  it("コメントだけの行と空行は完全に消える", () => {
    const src = "# 説明\n\n\nx = 1\n# もっと説明\n\n";
    const m = measure(src);
    expect(m.codeLines).toBe(1);
    expect(m.codeBytes).toBe("x = 1".length);
  });

  it("長いコメントを足しても codeBytes は変わらない", () => {
    const base = "def act(req):\n    return {'action': 'fold'}\n";
    const documented = "# " + "解説".repeat(500) + "\n" + base;
    expect(measure(documented).codeBytes).toBe(measure(base).codeBytes);
    expect(measure(documented).rawBytes).toBeGreaterThan(measure(base).rawBytes);
  });
});

describe("文字列の中の # はコメントではない", () => {
  it("シングル/ダブルクォート", () => {
    expect(stripPythonComments("s = '# not a comment'")).toBe("s = '# not a comment'");
    expect(stripPythonComments('s = "# not a comment"')).toBe('s = "# not a comment"');
  });

  it("三重クォート", () => {
    const src = 's = """\n# これも文字列\n"""\n';
    expect(stripPythonComments(src)).toBe(src);
  });

  it("エスケープされたクォートで文字列が終わらない", () => {
    const src = "s = 'it\\'s # fine'  # ここはコメント";
    const out = stripPythonComments(src);
    expect(out).toContain("it\\'s # fine");
    expect(out).not.toContain("ここはコメント");
  });

  it("文字列を閉じたあとの # はコメント", () => {
    expect(stripPythonComments("s = 'a'  # comment").trim()).toBe("s = 'a'");
  });
});

describe("docstring は数える(データの隠し場所にさせない)", () => {
  it("docstring は codeBytes に含まれる", () => {
    const withDoc = measure('def f():\n    """説明"""\n    return 1\n');
    const without = measure("def f():\n    return 1\n");
    expect(withDoc.codeBytes).toBeGreaterThan(without.codeBytes);
  });

  it("巨大なレンジ表を docstring に隠しても上限に引っかかる", () => {
    const table = "AA:1.0,KK:1.0,".repeat(1000);
    const src = `RANGES = """${table}"""\n`;
    const res = checkBotUpload("bot.py", src);
    expect(res.ok).toBe(false);
    expect(res.rejection?.code).toBe("too_long");
  });
});

describe("受け入れ判定", () => {
  it("シーズン1の上限は 8KB", () => {
    expect(DEFAULT_UPLOAD_LIMITS.maxCodeBytes).toBe(8192);
    expect(DEFAULT_UPLOAD_LIMITS.maxFiles).toBe(1);
    expect(DEFAULT_UPLOAD_LIMITS.language).toBe("python");
  });

  it("上限ぎりぎりは通り、1バイト超えると落ちる", () => {
    // "x=1" 行を n 本繋ぐと codeBytes は 3n + (n-1) = 4n-1
    const build = (n: number) => "x=1\n".repeat(n);
    const atLimit = build(2048); // 4*2048-1 = 8191
    expect(measure(atLimit).codeBytes).toBe(8191);
    expect(checkBotUpload("bot.py", atLimit).ok).toBe(true);

    const over = build(2049); // 8195
    expect(measure(over).codeBytes).toBe(8195);
    const rejected = checkBotUpload("bot.py", over);
    expect(rejected.ok).toBe(false);
    expect(rejected.rejection?.code).toBe("too_long");
  });

  it(".py 以外は受け付けない", () => {
    const r = checkBotUpload("bot.txt", "x = 1\n");
    expect(r.ok).toBe(false);
    expect(r.rejection?.code).toBe("not_python");
  });

  it("空のコードは受け付けない", () => {
    const r = checkBotUpload("bot.py", "\n\n# コメントだけ\n");
    expect(r.ok).toBe(false);
    expect(r.rejection?.code).toBe("empty");
  });

  it("コメントで水増ししても生バイト上限で止まる", () => {
    const src = "x = 1\n# " + "あ".repeat(200000) + "\n";
    const r = checkBotUpload("bot.py", src);
    expect(r.ok).toBe(false);
    expect(r.rejection?.code).toBe("raw_too_large");
  });
});
