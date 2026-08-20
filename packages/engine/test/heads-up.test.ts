import { describe, expect, it } from "vitest";
import type { ActRequest, ActResponse, LegalAction } from "@poker-arena/protocol";
import { parseCards } from "../src/cards.js";
import { Agent, HandConfig, HandResult, playHand } from "../src/engine.js";

/**
 * シーズン1 = ヘッズアップ(2人)NLH の仕様テスト。
 * HU では **ボタン = SB** で、プリフロップは先行・ポストフロップは後手。
 * デッキはボタンから1枚ずつ2周配られるので、button=0 なら
 *   deck[0]=seat0, deck[1]=seat1, deck[2]=seat0, deck[3]=seat1, 以降 flop×3, turn, river
 * の順になる(バーンカードなし)。
 */

const RAKE = { percent: 5, capChips: 400, noFlopNoDrop: true };
const STACK = 10_000; // 100bb

function huConfig(over: Partial<HandConfig> = {}): HandConfig {
  return {
    handId: "hu_test",
    seats: [
      { id: "A", stack: STACK },
      { id: "B", stack: STACK },
    ],
    button: 0,
    smallBlind: 50,
    bigBlind: 100,
    rake: RAKE,
    ...over,
  };
}

/** 席ごとに決め打ちのアクション列を返すエージェント */
function script(actions: ActResponse[]): Agent {
  let i = 0;
  return () => {
    const a = actions[i++];
    if (!a) throw new Error("script exhausted");
    return a;
  };
}

/** check できれば check、できなければ call。行動可能なら必ず続行する */
function passive(): Agent {
  return (req: ActRequest) => {
    if (req.legal_actions.some((l) => l.action === "check")) return { action: "check" };
    return { action: "call" };
  };
}

/** アクションを要求された順に `street:seat` で記録するラッパ */
function recorder(inner: Agent, log: string[]): Agent {
  return (req) => {
    log.push(`${req.street}:${req.seat}`);
    return inner(req);
  };
}

/** チップ保存則: 全席の net の合計 = -レーキ */
function expectChipsConserved(result: HandResult): void {
  // `0 - rake` と書くのは rake=0 のときの -0 を避けるため
  expect(result.seats.reduce((a, s) => a + s.net, 0)).toBe(0 - result.rake);
}

const netOf = (result: HandResult) => Object.fromEntries(result.seats.map((s) => [s.id, s.net]));

describe("heads-up: ブラインドとアクション順", () => {
  it("ボタンが SB を出し、プリフロップは先行・ポストフロップは後手になる", async () => {
    // A(seat0)=ボタン/SB。deck: A=Ac Ah, B=Kc Kd, board 2c 7d 9s Ts Jh
    const deck = parseCards("Ac Kc Ah Kd 2c 7d 9s Ts Jh");
    const log: string[] = [];
    const result = await playHand(huConfig({ button: 0, deck }), [
      recorder(passive(), log),
      recorder(passive(), log),
    ]);

    // ブラインド: ボタン(seat0)が SB、もう一方が BB
    expect(result.events.filter((e) => e.type === "blind")).toEqual([
      { type: "blind", seat: 0, kind: "sb", amount: 50 },
      { type: "blind", seat: 1, kind: "bb", amount: 100 },
    ]);

    expect(log).toEqual([
      "preflop:0", // ボタン(SB)が先行
      "preflop:1",
      "flop:1", // ポストフロップは BB が先行
      "flop:0",
      "turn:1",
      "turn:0",
      "river:1",
      "river:0",
    ]);
    expectChipsConserved(result);
  });

  it("席インデックスに依存しない: button=1 なら seat1 が SB で先行する", async () => {
    // button=1 なので配り順は seat1, seat0, seat1, seat0
    const deck = parseCards("Kc Ac Kd Ah 2c 7d 9s Ts Jh");
    const log: string[] = [];
    const result = await playHand(huConfig({ button: 1, deck }), [
      recorder(passive(), log),
      recorder(passive(), log),
    ]);

    expect(result.events.filter((e) => e.type === "blind")).toEqual([
      { type: "blind", seat: 1, kind: "sb", amount: 50 },
      { type: "blind", seat: 0, kind: "bb", amount: 100 },
    ]);
    expect(log.slice(0, 4)).toEqual(["preflop:1", "preflop:0", "flop:0", "flop:1"]);
    // 配り順どおり seat1 が Kc Kd、seat0 が Ac Ah
    expect(result.seats[1]!.holeCards).toEqual(["Kc", "Kd"]);
    expect(result.seats[0]!.holeCards).toEqual(["Ac", "Ah"]);
    expectChipsConserved(result);
  });

  it("ボタンがリンプしたら BB はオプションを check できる", async () => {
    const deck = parseCards("Ac Kc Ah Kd 2c 7d 9s Ts Jh");
    const bbPreflopLegal: LegalAction[] = [];
    const bb: Agent = (req) => {
      if (req.street === "preflop") bbPreflopLegal.push(...req.legal_actions);
      return req.legal_actions.some((l) => l.action === "check") ? { action: "check" } : { action: "call" };
    };
    const result = await playHand(huConfig({ button: 0, deck }), [passive(), bb]);

    // リンプに対する BB は check と raise(min = 2bb)のみ。fold も call も無い
    expect(bbPreflopLegal).toEqual([{ action: "check" }, { action: "raise", min: 200, max: 10_000 }]);
    // 実際に check が採用され、強制変換されていない
    const bbCheck = result.events.find(
      (e) => e.type === "action" && e.record.street === "preflop" && e.record.seat === 1,
    );
    expect(bbCheck && bbCheck.type === "action" && bbCheck.record.action).toBe("check");
    expect(result.events.some((e) => e.type === "action" && e.record.forced)).toBe(false);
    expectChipsConserved(result);
  });
});

describe("heads-up: ポットとレーキ", () => {
  it("リンプ → チェックダウンでショーダウンに到達し、ポットとレーキが一致する", async () => {
    // A=Ac Ah(AA)、B=Kc Kd(KK)、board 2c 7d 9s Ts Jh → AA の勝ち
    const deck = parseCards("Ac Kc Ah Kd 2c 7d 9s Ts Jh");
    const result = await playHand(huConfig({ button: 0, deck }), [passive(), passive()]);

    expect(result.board).toEqual(["2c", "7d", "9s", "Ts", "Jh"]);
    expect(result.totalPot).toBe(200); // 1bb ずつ
    expect(result.rake).toBe(10); // 5% of 200(キャップ未満)
    expect(result.seats.every((s) => s.showedDown)).toBe(true);
    expect(netOf(result)).toEqual({ A: 90, B: -100 }); // 200 - 10 = 190 を獲得
    expectChipsConserved(result);
  });

  it("プリフロップで決着したハンドはレーキなし・ボードも配られない", async () => {
    const result = await playHand(huConfig({ button: 0, seed: 3 }), [
      script([{ action: "fold" }]), // ボタン(SB)が降りる
      passive(),
    ]);

    expect(result.board).toEqual([]);
    expect(result.rake).toBe(0);
    // totalPot は「実際に争われた額」。BB の 100 のうち SB の 50 とマッチしなかった
    // 50 は未コール分として BB に返るので、ポットは 150 ではなく 100。
    expect(result.totalPot).toBe(100);
    expect(netOf(result)).toEqual({ A: -50, B: 50 });
    expectChipsConserved(result);
  });

  it("フロップを見たハンドはポットの 5%(キャップ 400)を払う", async () => {
    const deck = parseCards("As Kh Ad Ks 2c 7d 9s Th Jc");
    // プリフロップで 10bb ずつ入れて、以降チェックダウン → ポット 2000
    const uncapped = await playHand(huConfig({ button: 0, deck }), [
      script([{ action: "raise", amount: 1000 }, { action: "check" }, { action: "check" }, { action: "check" }]),
      script([{ action: "call" }, { action: "check" }, { action: "check" }, { action: "check" }]),
    ]);
    expect(uncapped.totalPot).toBe(2000);
    expect(uncapped.rake).toBe(100); // 5% of 2000 < 400
    expect(netOf(uncapped)).toEqual({ A: 900, B: -1000 });
    expectChipsConserved(uncapped);

    // 100bb ずつのオールイン → ポット 20000、5% = 1000 だがキャップ 400
    const capped = await playHand(huConfig({ button: 0, deck }), [
      script([{ action: "raise", amount: STACK }]),
      script([{ action: "call" }]),
    ]);
    expect(capped.totalPot).toBe(20_000);
    expect(capped.rake).toBe(400);
    expectChipsConserved(capped);
  });
});

describe("heads-up: オールイン", () => {
  it("プリフロップのオールイン対決はボード5枚をランアウトして正しく配当する", async () => {
    // A=As Ad(AA)、B=Kh Ks(KK)、board 2c 7d 9s Th Jc → AA の勝ち
    const deck = parseCards("As Kh Ad Ks 2c 7d 9s Th Jc");
    const result = await playHand(huConfig({ button: 0, deck }), [
      script([{ action: "raise", amount: STACK }]), // ボタンが 100bb オールイン
      script([{ action: "call" }]),
    ]);

    expect(result.seats[0]!.holeCards).toEqual(["As", "Ad"]);
    expect(result.seats[1]!.holeCards).toEqual(["Kh", "Ks"]);
    // フロップ・ターン・リバーが全て配られる
    expect(result.board).toEqual(["2c", "7d", "9s", "Th", "Jc"]);
    expect(result.events.filter((e) => e.type === "deal").map((e) => e.type === "deal" && e.street)).toEqual([
      "flop",
      "turn",
      "river",
    ]);
    expect(result.totalPot).toBe(20_000);
    expect(result.rake).toBe(400);
    // 勝者は 20000 - 400 = 19600 を受け取る(自分の 10000 込み)
    expect(result.seats[0]!.won).toBe(19_600);
    expect(netOf(result)).toEqual({ A: 9600, B: -10_000 });
    expect(result.seats.every((s) => s.showedDown)).toBe(true);
    expectChipsConserved(result);
  });

  it("オールインがコールされずに終わればレーキなし・ボードも配られない", async () => {
    const result = await playHand(huConfig({ button: 0, seed: 11 }), [
      script([{ action: "raise", amount: STACK }]),
      script([{ action: "fold" }]),
    ]);
    expect(result.board).toEqual([]);
    expect(result.rake).toBe(0);
    expect(netOf(result)).toEqual({ A: 100, B: -100 });
    expectChipsConserved(result);
  });
});
