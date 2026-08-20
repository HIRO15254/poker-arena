import { describe, expect, it } from "vitest";
import { CHIPS_PER_BB } from "@poker-arena/protocol";
import { Agent, HandConfig, HandResult, mulberry32, playHand } from "@poker-arena/engine";
import { BOT_NAMES, BotName, makeBot } from "../src/bots.js";
import { runSimulation } from "../src/run.js";

/** シーズン1 のヘッズアップ条件でベンチマーク bot を回す。 */

const STACK = 100 * CHIPS_PER_BB;
const RAKE = { percent: 5, capChips: 4 * CHIPS_PER_BB, noFlopNoDrop: true };

/**
 * `runSimulation` と同じ条件(毎ハンド 100bb リセット、ボタン交代)で回しつつ、
 * 判定用にハンド結果(イベント込み)をそのまま返す。
 */
async function playMatch(agents: [Agent, Agent], hands: number, seed: number): Promise<HandResult[]> {
  const seedRng = mulberry32(seed);
  const out: HandResult[] = [];
  for (let h = 0; h < hands; h++) {
    const config: HandConfig = {
      handId: `m_${seed}_${h}`,
      seats: [
        { id: "hero", stack: STACK },
        { id: "villain", stack: STACK },
      ],
      button: h % 2,
      smallBlind: CHIPS_PER_BB / 2,
      bigBlind: CHIPS_PER_BB,
      rake: RAKE,
      seed: Math.floor(seedRng() * 2 ** 31),
    };
    out.push(await playHand(config, agents));
  }
  return out;
}

const lineup = (a: BotName, b: BotName, seed: number) => [
  { id: `${a}-0`, agent: makeBot(a, seed * 1000) },
  { id: `${b}-1`, agent: makeBot(b, seed * 1000 + 1) },
];

describe("checkFoldBot 同士の HU は理論値どおりになる", () => {
  it("偶数ハンドではボタン回数が等しく、両者ちょうど ±0 になる", async () => {
    const hands = 1000;
    const result = await runSimulation(lineup("fold", "fold", 5), { hands, seed: 5 });

    // SB(=ボタン)は毎ハンド 50 チップを捨て、BB が 50 チップを拾う。
    // ボタンは毎ハンド交代するので、偶数ハンドなら完全に相殺される。
    expect(result.totals.get("fold-0")).toBe(0);
    expect(result.totals.get("fold-1")).toBe(0);
    expect(result.bb100.get("fold-0")).toBe(0);
    expect(result.bb100.get("fold-1")).toBe(0);
  });

  it("奇数ハンドでは先にボタンを持つ側が SB 1回分だけ負ける", async () => {
    const hands = 101; // fold-0 が 51 回ボタン、fold-1 が 50 回
    const result = await runSimulation(lineup("fold", "fold", 5), { hands, seed: 5 });

    // 51 回 -50、50 回 +50 → -50 チップ = -0.5bb
    expect(result.totals.get("fold-0")).toBe(-50);
    expect(result.totals.get("fold-1")).toBe(50);
    // bb/100 = (net / 100) / hands * 100
    expect(result.bb100.get("fold-0")).toBe((-50 / CHIPS_PER_BB / hands) * 100);
    expect(result.bb100.get("fold-1")).toBe((50 / CHIPS_PER_BB / hands) * 100);

    // フロップを一度も見ないのでレーキはゼロ。よって収支の合計もゼロ
    expect((result.totals.get("fold-0") ?? 0) + (result.totals.get("fold-1") ?? 0)).toBe(0);
  });
});

describe("全ベンチマーク bot が 500 ハンドの HU を無事故で回せる", () => {
  it("makeBot は BOT_NAMES を網羅している", () => {
    for (const name of BOT_NAMES) expect(typeof makeBot(name, 1)).toBe("function");
    expect(new Set(BOT_NAMES).size).toBe(BOT_NAMES.length);
  });

  for (const name of BOT_NAMES) {
    it(`${name} vs call: 例外なし・強制変換(forced)なし・チップ保存則`, async () => {
      const hands = 500;
      const results = await playMatch([makeBot(name, 12_345), makeBot("call", 999)], hands, 42);
      expect(results).toHaveLength(hands);

      const forced = results.flatMap((r) =>
        r.events.filter((e) => e.type === "action" && e.record.forced === true),
      );
      // forced が付くのは「非合法アクション or 例外」をエンジンが check/fold に矯正したとき。
      // 行儀の良い bot は一度も発生させてはいけない。
      expect(forced).toEqual([]);

      for (const r of results) {
        expect(r.seats.reduce((a, s) => a + s.net, 0)).toBe(0 - r.rake);
        expect(r.rake).toBeLessThanOrEqual(RAKE.capChips);
        // ノーフロップ・ノードロップ
        if (r.board.length < 3) expect(r.rake).toBe(0);
        else expect(r.rake).toBe(Math.min(Math.floor((r.totalPot * 5) / 100), RAKE.capChips));
      }
    });
  }
});

describe("決定性", () => {
  it("同じシードなら 2 回の実行が完全に一致する", async () => {
    const run = () => runSimulation(lineup("balanced", "lag", 7), { hands: 300, seed: 7 });
    const a = await run();
    const b = await run();
    expect([...b.totals.entries()]).toEqual([...a.totals.entries()]);
    expect([...b.bb100.entries()]).toEqual([...a.bb100.entries()]);
  });

  it("同じシードならハンドごとのアクション列まで一致する", async () => {
    const play = () => playMatch([makeBot("balanced", 31), makeBot("tight", 32)], 120, 3);
    const a = await play();
    const b = await play();
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("シードが変われば結果が変わる(乱数が実際に注入されている)", async () => {
    const a = await runSimulation(lineup("balanced", "random", 1), { hands: 300, seed: 1 });
    const b = await runSimulation(lineup("balanced", "random", 2), { hands: 300, seed: 2 });
    expect(b.totals.get("balanced-0")).not.toBe(a.totals.get("balanced-0"));
  });
});

describe("改良した bot が弱い bot に勝つ", () => {
  const beats = async (strong: BotName, weak: BotName) => {
    const result = await runSimulation(lineup(strong, weak, 9), { hands: 1500, seed: 9 });
    return result.bb100.get(`${strong}-0`) ?? 0;
  };

  it("tight は call/fold/random を上回る", async () => {
    expect(await beats("tight", "call")).toBeGreaterThan(0);
    expect(await beats("tight", "random")).toBeGreaterThan(0);
    expect(await beats("tight", "fold")).toBeGreaterThan(0);
  });

  it("balanced / lag は random を上回る", async () => {
    expect(await beats("balanced", "random")).toBeGreaterThan(0);
    expect(await beats("lag", "random")).toBeGreaterThan(0);
  });
});
