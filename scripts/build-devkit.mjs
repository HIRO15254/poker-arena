#!/usr/bin/env node
/**
 * bot 開発キットのバンドルを作る。
 *
 *     node scripts/build-devkit.mjs
 *
 * 出力は 2 つ:
 *   - `apps/web/public/devkit/`         個別に fetch できる素のファイル群 + `manifest.json`
 *   - `apps/web/public/poker-arena-devkit.zip`  同じツリーを 1 ファイルにまとめたもの
 *
 * zip は無圧縮(STORE)で自前で書く。npm 依存も `zip` コマンドも要らないので、
 * どのマシンでも同じ結果になる。中身は元ファイルのコピーで、書き換えはしない。
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "apps", "web", "public");
const OUT_DIR = join(PUBLIC_DIR, "devkit");
const ZIP_NAME = "poker-arena-devkit.zip";

/** バンドルの中身。[キット内のパス, リポジトリ内のパス] */
const FILES = [
  ["DEVKIT_README.md", "sdk/python/DEVKIT_README.md"],
  ["README.md", "sdk/python/README.md"],
  ["pyproject.toml", "sdk/python/pyproject.toml"],
  ["check_bot.py", "sdk/python/check_bot.py"],

  ...["__init__", "bot", "cards", "client", "server", "types", "upload"].map((m) => [
    `poker_arena/${m}.py`,
    `sdk/python/poker_arena/${m}.py`,
  ]),

  ...["always_call", "tight_bot", "equity_bot"].map((m) => [
    `examples/${m}.py`,
    `sdk/python/examples/${m}.py`,
  ]),

  ...["test_evaluator", "test_tight_bot", "test_upload"].map((m) => [
    `tests/${m}.py`,
    `sdk/python/tests/${m}.py`,
  ]),

  ["docs/BOT_DEVELOPMENT.md", "docs/BOT_DEVELOPMENT.md"],
  ["docs/API.md", "docs/API.md"],
  ["docs/llms.txt", "docs/llms.txt"],

  ["schema/act_request.schema.json", "packages/protocol/schema/act_request.schema.json"],
  ["schema/act_response.schema.json", "packages/protocol/schema/act_response.schema.json"],
];

// ---------------------------------------------------------------- zip writer

let crcTable = null;

/** CRC-32 (IEEE)。`node:zlib` にあればそれを使い、古い Node では自前で計算する。 */
function crc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  if (crcTable === null) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const dosTime = (d) =>
  ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
const dosDate = (d) =>
  (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

/**
 * STORE のみの zip を組み立てる。
 * ローカルヘッダ → 中央ディレクトリ → EOCD。ディレクトリエントリは書かない
 * (パスの `/` から展開側が作る)。
 */
function buildZip(entries, when) {
  const time = dosTime(when);
  const date = dosDate(when);
  const body = [];
  const central = [];
  let offset = 0;

  for (const { path, data } of entries) {
    const name = Buffer.from(path, "utf8"); // 区切りは常に `/`
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // ローカルファイルヘッダ署名
    local.writeUInt16LE(20, 4); // 展開に必要なバージョン (2.0)
    local.writeUInt16LE(0x0800, 6); // 汎用フラグ: ファイル名は UTF-8
    local.writeUInt16LE(0, 8); // 圧縮方式: 0 = store
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // 圧縮後サイズ
    local.writeUInt32LE(data.length, 22); // 圧縮前サイズ
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field なし
    body.push(local, name, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); // 中央ディレクトリ署名
    entry.writeUInt16LE(20, 4); // 作成バージョン
    entry.writeUInt16LE(20, 6); // 展開に必要なバージョン
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30); // extra
    entry.writeUInt16LE(0, 32); // comment
    entry.writeUInt16LE(0, 34); // 開始ディスク番号
    entry.writeUInt16LE(0, 36); // internal attributes
    entry.writeUInt32LE(0, 38); // external attributes
    entry.writeUInt32LE(offset, 42); // ローカルヘッダの位置
    central.push(entry, name);

    offset += local.length + name.length + data.length;
  }

  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD 署名
  eocd.writeUInt16LE(0, 4); // このディスクの番号
  eocd.writeUInt16LE(0, 6); // 中央ディレクトリのあるディスク
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16); // 中央ディレクトリの開始位置
  eocd.writeUInt16LE(0, 20); // コメントなし

  return Buffer.concat([...body, directory, eocd]);
}

// ---------------------------------------------------------------------- main

const when = new Date();

const entries = FILES.map(([path, source]) => {
  try {
    return { path, data: readFileSync(join(ROOT, source)) };
  } catch {
    throw new Error(`devkit: 元ファイルが読めない: ${source}`);
  }
}).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const { path, data } of entries) {
  const target = join(OUT_DIR, ...path.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
}

const zip = buildZip(entries, when);
writeFileSync(join(PUBLIC_DIR, ZIP_NAME), zip);

const manifest = {
  generatedAt: when.toISOString(),
  files: entries.map(({ path, data }) => ({ path, bytes: data.length })),
  zip: { path: `/${ZIP_NAME}`, bytes: zip.length },
};
writeFileSync(join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const total = entries.reduce((n, e) => n + e.data.length, 0);
console.log(
  `devkit: ${entries.length} files, ${total} bytes -> apps/web/public/devkit/ + ${ZIP_NAME} (${zip.length} bytes)`,
);
