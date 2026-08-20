import { describe, expect, it } from "vitest";
import type { ActRequest, ActResponse, LegalAction } from "@poker-arena/protocol";
import { parseCards } from "../src/cards.js";
import { Agent, HandConfig, playHand } from "../src/engine.js";

const RAKE = { percent: 5, capChips: 400, noFlopNoDrop: true };

/** 席ごとに決め打ちのアクション列を返すエージェント */
function script(actions: ActResponse[]): Agent {
  let i = 0;
  return () => {
    const a = actions[i++];
    if (!a) throw new Error("script exhausted");
    return a;
  };
}

function foldOrCheck(): Agent {
  return (req: ActRequest) =>
    req.legal_actions.some((l) => l.action === "check") ? { action: "check" } : { action: "fold" };
}

describe("playHand", () => {
  it("デザインモックのハンド: ポット/レーキ/収支が一致する", async () => {
    // 6-max, button=3: SB=4, BB=5, UTG=0, HJ=1, CO=2, BTN=3
    // 配り順は SB から: 4,5,0,1,2,3 ×2
    const deck = parseCards("9c Jc Qs 7d Kc As 8c 4h Qd 2d Kh Kd 7h 2c Ks 9s 3d");
    const config: HandConfig = {
      handId: "h_test1",
      seats: Array.from({ length: 6 }, (_, i) => ({ id: `bot${i}`, stack: 10000 })),
      button: 3,
      smallBlind: 50,
      bigBlind: 100,
      rake: RAKE,
      deck,
    };
    const agents: Agent[] = [
      script([{ action: "raise", amount: 250 }, { action: "check" }, { action: "fold" }]), // UTG QQ
      script([{ action: "fold" }]), // HJ
      script([
        { action: "call" },
        { action: "raise", amount: 300 },
        { action: "raise", amount: 1200 },
        { action: "raise", amount: 8250 },
      ]), // CO KK
      script([{ action: "call" }, { action: "call" }, { action: "call" }, { action: "call" }]), // BTN AsKd
      script([{ action: "fold" }]), // SB
      script([{ action: "fold" }]), // BB
    ];
    const result = await playHand(config, agents);

    expect(result.board).toEqual(["7h", "2c", "Ks", "9s", "3d"]);
    expect(result.totalPot).toBe(20400);
    expect(result.rake).toBe(400); // min(5% of 20400, 400)
    const net = Object.fromEntries(result.seats.map((s) => [s.id, s.net]));
    expect(net).toEqual({
      bot0: -250,
      bot1: 0,
      bot2: 10000, // 20400 - 400 - 自分の10000
      bot3: -10000,
      bot4: -50,
      bot5: -100,
    });
    expect(result.seats[2]!.showedDown).toBe(true);
    expect(result.seats[3]!.showedDown).toBe(true);
    // チップ保存則: 全収支の合計 = -レーキ
    expect(result.seats.reduce((a, s) => a + s.net, 0)).toBe(-result.rake);
  });

  it("プリフロップで決着したハンドはレーキなし(no flop no drop)、フロップは配らない", async () => {
    const config: HandConfig = {
      seats: Array.from({ length: 6 }, (_, i) => ({ id: `bot${i}`, stack: 10000 })),
      button: 3,
      smallBlind: 50,
      bigBlind: 100,
      rake: RAKE,
      seed: 42,
    };
    const agents: Agent[] = Array.from({ length: 6 }, () => foldOrCheck());
    const result = await playHand(config, agents);
    expect(result.rake).toBe(0);
    expect(result.board).toEqual([]);
    const bb = result.seats[5]!;
    expect(bb.net).toBe(50); // SB の 50 を獲得
  });

  it("サイドポット: ショートスタックがメインポットのみ獲得できる", async () => {
    // 3人, button=0: SB=1, BB=2。配り順 1,2,0 ×2
    const deck = parseCards("As Qs Ks Ad Qd Kd 2c 5d 7h 9s Jh");
    const config: HandConfig = {
      seats: [
        { id: "A", stack: 1000 },
        { id: "B", stack: 500 },
        { id: "C", stack: 2000 },
      ],
      button: 0,
      smallBlind: 50,
      bigBlind: 100,
      rake: RAKE,
      deck,
    };
    const agents: Agent[] = [
      script([{ action: "raise", amount: 1000 }]), // A: KK 全額
      script([{ action: "call" }]), // B: AA (500 all-in)
      script([{ action: "call" }]), // C: QQ
    ];
    const result = await playHand(config, agents);
    expect(result.totalPot).toBe(2500);
    expect(result.rake).toBe(125); // 5% of 2500, cap 未満
    const net = Object.fromEntries(result.seats.map((s) => [s.id, s.net]));
    // B(AA) がメインポット 1500-125=1375、A(KK) がサイドポット 1000
    expect(net).toEqual({ A: 0, B: 875, C: -1000 });
  });

  it("ショートオールインはアクションを再オープンしない", async () => {
    // 3人, button=0: SB=1, BB=2(スタック350)。
    const deck = parseCards("Kc 5h As Qc 6h Ah 2d 7s 9h Jd 4s");
    const config: HandConfig = {
      seats: [
        { id: "A", stack: 10000 },
        { id: "B", stack: 10000 },
        { id: "C", stack: 350 },
      ],
      button: 0,
      smallBlind: 50,
      bigBlind: 100,
      rake: RAKE,
      deck,
    };
    const seenLegal: LegalAction[][] = [];
    const agentA: Agent = (req) => {
      seenLegal.push(req.legal_actions);
      // 1回目: raise to 300 / 2回目(ショートオールイン 350 に直面): call
      return seenLegal.length === 1 ? { action: "raise", amount: 300 } : { action: "call" };
    };
    const agents: Agent[] = [
      agentA,
      script([{ action: "call" }, { action: "call" }]), // B
      script([{ action: "raise", amount: 350 }]), // C: 250 上乗せ(< min raise 200+... フルレイズ幅300未満) all-in
    ];
    const result = await playHand(config, agents);
    // A の2回目のアクションでは raise が合法に含まれない
    const second = seenLegal[1]!;
    expect(second.some((l) => l.action === "raise")).toBe(false);
    expect(second.some((l) => l.action === "call")).toBe(true);
    // C のレイズは all_in として記録される
    const cRaise = result.events.find((e) => e.type === "action" && e.record.seat === 2 && e.record.action === "raise");
    expect(cRaise && cRaise.type === "action" && cRaise.record.all_in).toBe(true);
    expect(result.totalPot).toBe(1050);
  });

  it("不正なアクションは check/fold に強制変換される", async () => {
    // ヘッズアップ: button=0 が SB でプリフロップ先行
    const config: HandConfig = {
      seats: [
        { id: "A", stack: 10000 },
        { id: "B", stack: 10000 },
      ],
      button: 0,
      smallBlind: 50,
      bigBlind: 100,
      rake: RAKE,
      seed: 7,
    };
    const agents: Agent[] = [
      script([{ action: "raise", amount: 999999 }]), // max 超過 → 不正 → fold 強制
      foldOrCheck(),
    ];
    const result = await playHand(config, agents);
    const forced = result.events.find((e) => e.type === "action" && e.record.forced);
    expect(forced && forced.type === "action" && forced.record.action).toBe("fold");
    const net = Object.fromEntries(result.seats.map((s) => [s.id, s.net]));
    expect(net).toEqual({ A: -50, B: 50 });
  });
});
