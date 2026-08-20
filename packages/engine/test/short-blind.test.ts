import { describe, expect, it } from "vitest";
import type { ActRequest, LegalAction } from "@poker-arena/protocol";
import { parseCards } from "../src/cards.js";
import { Agent, HandConfig, playHand } from "../src/engine.js";

const RAKE = { percent: 5, capChips: 400, noFlopNoDrop: true };

/**
 * ブラインドを満額出せずオールインになった相手に対して、
 * もう一方がコール/フォールドを選べるか(修正前は選択権が無いまま showdown に進んでいた)。
 */
describe("ブラインドがオールインで満額に満たない場合", () => {
  // HU, button=0 が SB。配り順は button から: 0,1,0,1
  const deck = () => parseCards("As Kc Ad Kd 2h 7s 9c Jd 4s");

  function baseConfig(bbStack: number): HandConfig {
    return {
      handId: "h_shortblind",
      seats: [
        { id: "btn", stack: 10000 },
        { id: "bb", stack: bbStack },
      ],
      button: 0,
      smallBlind: 50,
      bigBlind: 100,
      rake: RAKE,
      deck: deck(),
    };
  }

  it("ボタンにアクションの機会が与えられ、合法手は実際の最大額を基準にする", async () => {
    const seen: LegalAction[][] = [];
    const btn: Agent = (req: ActRequest) => {
      seen.push(req.legal_actions);
      return { action: "fold" };
    };
    const bb: Agent = () => ({ action: "check" });
    const result = await playHand(baseConfig(60), [btn, bb]);

    // ボタンは必ず1回問い合わせを受ける
    expect(seen.length).toBe(1);
    const legal = seen[0]!;
    // BB はオールインで 60 しか出せていないので、コール額は 100-50 ではなく 60-50 = 10
    const call = legal.find((l) => l.action === "call");
    expect(call).toEqual({ action: "call", amount: 10 });
    expect(legal.some((l) => l.action === "fold")).toBe(true);

    // フォールドしたので board は配られず、レーキも無い
    expect(result.board).toEqual([]);
    expect(result.rake).toBe(0);
    const net = Object.fromEntries(result.seats.map((s) => [s.id, s.net]));
    expect(net).toEqual({ btn: -50, bb: 50 });
    expect(result.seats.reduce((a, s) => a + s.net, 0)).toBe(0 - result.rake);
  });

  it("コールするとボードが5枚流れ、ショーダウンで決着する", async () => {
    const btn: Agent = () => ({ action: "call" });
    const bb: Agent = () => ({ action: "check" });
    const result = await playHand(baseConfig(60), [btn, bb]);

    expect(result.board).toHaveLength(5);
    expect(result.totalPot).toBe(120);
    // フロップが開いたのでレーキがかかる(5% of 120 = 6)
    expect(result.rake).toBe(6);
    expect(result.seats.every((s) => s.showedDown)).toBe(true);
    expect(result.seats.reduce((a, s) => a + s.net, 0)).toBe(0 - result.rake);
  });

  it("SB もオールインで BB より少ない場合はアクションが発生しない", async () => {
    const config: HandConfig = {
      ...baseConfig(10000),
      seats: [
        { id: "btn", stack: 30 },
        { id: "bb", stack: 10000 },
      ],
    };
    let asked = 0;
    const btn: Agent = () => {
      asked++;
      return { action: "fold" };
    };
    const bb: Agent = () => {
      asked++;
      return { action: "check" };
    };
    const result = await playHand(config, [btn, bb]);

    // 両者とも支払い義務が残らない(SB は全部出してオールイン、BB は誰も上乗せしていない)
    expect(asked).toBe(0);
    expect(result.totalPot).toBe(130);
    // 未コール分の 70 は BB に戻る
    const net = Object.fromEntries(result.seats.map((s) => [s.id, s.net]));
    expect(net.btn! + net.bb!).toBe(0 - result.rake);
  });
});
