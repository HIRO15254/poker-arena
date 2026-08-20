import { describe, expect, it } from "vitest";
import type { ActResponse } from "@poker-arena/protocol";
import { parseCards } from "../src/cards.js";
import { Agent, HandConfig, playHand } from "../src/engine.js";

const RAKE = { percent: 5, capChips: 400, noFlopNoDrop: true };

function script(actions: ActResponse[]): Agent {
  let i = 0;
  return () => {
    const a = actions[i++];
    if (!a) throw new Error("script exhausted");
    return a;
  };
}

/**
 * 相手にコールされなかったベット(uncalled bet)は賭けた本人に返され、
 * レーキは「実際に争われたポット」にのみ課される。
 *
 * 修正前は committed の総額にレーキをかけていたため、
 * フォールド勝ちするたびにベットした側が余分に課金されていた。
 */
describe("未コール分の返却とレーキの課税ベース", () => {
  // HU, button=0 が SB。配り順は button から: 0,1,0,1、その後フロップ
  const deck = () => parseCards("As Kc Ad Kd 2h 7s 9c Jd 4s");

  function config(): HandConfig {
    return {
      handId: "h_uncalled",
      seats: [
        { id: "sb", stack: 10000 },
        { id: "bb", stack: 10000 },
      ],
      button: 0,
      smallBlind: 50,
      bigBlind: 100,
      rake: RAKE,
      deck: deck(),
    };
  }

  it("フロップのベットにフォールドされた場合、ベット分にはレーキがかからない", async () => {
    const result = await playHand(config(), [
      // SB: プリフロップ 250 にレイズ → フロップ 400 ベット
      script([{ action: "raise", amount: 250 }, { action: "raise", amount: 400 }]),
      // BB: コール → チェック → フォールド
      script([{ action: "call" }, { action: "check" }, { action: "fold" }]),
    ]);

    // 争われたのは 250 ずつの 500。SB の 400 ベットは未コールなので返る
    expect(result.totalPot).toBe(500);
    expect(result.rake).toBe(25); // 5% of 500
    const net = Object.fromEntries(result.seats.map((s) => [s.id, s.net]));
    expect(net).toEqual({ sb: 225, bb: -250 });
    expect(result.seats.reduce((a, s) => a + s.net, 0)).toBe(0 - result.rake);
  });

  it("オールインにフォールドされても勝者がチップを失わない", async () => {
    const result = await playHand(config(), [
      // SB: プリフロップ 250 にレイズ → フロップで残り全部(9750)を投入
      script([{ action: "raise", amount: 250 }, { action: "raise", amount: 9750 }]),
      script([{ action: "call" }, { action: "check" }, { action: "fold" }]),
    ]);

    expect(result.totalPot).toBe(500);
    expect(result.rake).toBe(25);
    const net = Object.fromEntries(result.seats.map((s) => [s.id, s.net]));
    // 修正前はレーキが min(5% of 10250, 400) = 400 になり sb の net が -150 だった
    expect(net.sb).toBe(225);
    expect(net.sb!).toBeGreaterThan(0);
    expect(result.seats.reduce((a, s) => a + s.net, 0)).toBe(0 - result.rake);
  });

  it("全額コールされたハンドはポットもレーキも変わらない", async () => {
    const result = await playHand(config(), [
      script([{ action: "raise", amount: 250 }, { action: "raise", amount: 400 }, { action: "check" }, { action: "check" }]),
      script([{ action: "call" }, { action: "check" }, { action: "call" }, { action: "check" }, { action: "check" }]),
    ]);

    expect(result.totalPot).toBe(1300); // 650 ずつ
    expect(result.rake).toBe(65);
    expect(result.seats.reduce((a, s) => a + s.net, 0)).toBe(0 - result.rake);
  });
});
