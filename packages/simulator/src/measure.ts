/**
 * 提出前にコード長を確認する。Python SDK の `check_bot.py` と同じ結果を返す。
 *
 *   pnpm measure sdk/python/examples/tight_bot.py
 *   pnpm measure --tsv a.py b.py     # 機械可読(照合用)
 */
import { readFileSync } from "node:fs";
import { DEFAULT_UPLOAD_LIMITS, checkBotUpload, measurePythonCode } from "@poker-arena/protocol";

const args = process.argv.slice(2);
const tsv = args.includes("--tsv");
const files = args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("usage: pnpm measure [--tsv] <bot.py> [...]");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (tsv) {
    const m = measurePythonCode(source);
    console.log(`${file}\t${m.codeBytes}\t${m.rawBytes}\t${m.codeLines}`);
    continue;
  }
  const res = checkBotUpload(file, source, DEFAULT_UPLOAD_LIMITS);
  const m = res.measurement;
  const width = 40;
  const filled = Math.min(width, Math.round((m.codeBytes / DEFAULT_UPLOAD_LIMITS.maxCodeBytes) * width));
  console.log(file);
  console.log(`  [${"#".repeat(filled)}${".".repeat(width - filled)}] ${m.codeBytes} / ${DEFAULT_UPLOAD_LIMITS.maxCodeBytes} バイト`);
  console.log(`  実コード ${m.codeLines} 行 / 全体 ${m.rawBytes} バイト(コメント・空行 ${m.freeBytes} バイトは無料)`);
  if (res.ok) {
    console.log(`  OK — あと ${DEFAULT_UPLOAD_LIMITS.maxCodeBytes - m.codeBytes} バイト使えます`);
  } else {
    console.log(`  NG — ${res.rejection?.message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
