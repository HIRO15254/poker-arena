import { describe, expect, it } from "vitest";
import { parseCards } from "../packages/engine/src/cards.js";
import { Agent, HandConfig, playHand } from "../packages/engine/src/engine.js";

const RAKE = { percent: 5, capChips: 400, noFlopNoDrop: true };
const STACK = 10_000;
function huConfig(over: Partial<HandConfig> = {}): HandConfig {
  return { handId: "t", seats: [{ id: "A", stack: STACK }, { id: "B", stack: STACK }],
    button: 0, smallBlind: 50, bigBlind: 100, rake: RAKE, ...over };
}
function script(actions: any[]): Agent {
  let i = 0;
  return () => { const a = actions[i++]; if (!a) throw new Error("exhausted"); return a; };
}

describe("probe", () => {
  it("uncalled bet is raked", async () => {
    // deck: A=Ac Ah, B=Kc Kd, board 2c 7d 9s Ts Jh
    const deck = parseCards("Ac Kc Ah Kd 2c 7d 9s Ts Jh");
    // preflop: A(btn/SB) raise to 250, B call. flop: B check, A bet 400, B fold
    const A = script([{ action: "raise", amount: 250 }, { action: "raise", amount: 400 }]);
    const B = script([{ action: "call" }, { action: "check" }, { action: "fold" }]);
    const r = await playHand(huConfig({ deck }), [A, B]);
    console.log("pot", r.totalPot, "rake", r.rake, "nets", r.seats.map(s=>[s.id,s.net]));
    expect(r.seats.reduce((a,s)=>a+s.net,0)).toBe(0 - r.rake);
  });

  it("huge uncalled overbet on flop", async () => {
    const deck = parseCards("Ac Kc Ah Kd 2c 7d 9s Ts Jh");
    const A = script([{ action: "raise", amount: 250 }, { action: "raise", amount: 10000 }]);
    const B = script([{ action: "call" }, { action: "check" }, { action: "fold" }]);
    const r = await playHand(huConfig({ deck }), [A, B]);
    console.log("pot", r.totalPot, "rake", r.rake, "nets", r.seats.map(s=>[s.id,s.net]));
  });

  it("preflop shove folded to -> no flop no drop", async () => {
    const deck = parseCards("Ac Kc Ah Kd 2c 7d 9s Ts Jh");
    const A = script([{ action: "raise", amount: 10000 }]);
    const B = script([{ action: "fold" }]);
    const r = await playHand(huConfig({ deck }), [A, B]);
    console.log("pot", r.totalPot, "rake", r.rake, "nets", r.seats.map(s=>[s.id,s.net]));
  });

  it("short all-in does not reopen for the raiser (3 players)", async () => {
    const cfg: HandConfig = { handId: "t3", seats: [{id:"A",stack:10000},{id:"B",stack:10000},{id:"C",stack:400}],
      button: 0, smallBlind: 50, bigBlind: 100, rake: RAKE, deck: parseCards("Ac Kc Qc Ah Kd Qd 2c 7d 9s Ts Jh") };
    const legalLog: any[] = [];
    const mk = (name: string, acts: any[]): Agent => { let i=0; return (req)=>{ legalLog.push([name, req.street, JSON.stringify(req.legal_actions)]); const a=acts[i++]; if(!a) throw new Error(name+" exhausted"); return a; }; };
    // preflop: A(btn) raise to 300, B(sb) ... order: UTG.. with n=3 preflop start = button+3 = button = A
    const A = mk("A", [{action:"raise", amount:300},{action:"call"}]);
    const B = mk("B", [{action:"call"},{action:"call"}]);
    const C = mk("C", [{action:"raise", amount:400}]);
    const r = await playHand(cfg, [A,B,C]);
    console.log(legalLog);
    console.log("pot", r.totalPot, "rake", r.rake, "nets", r.seats.map(s=>[s.id,s.net,s.committed]));
    expect(r.seats.reduce((a,s)=>a+s.net,0)).toBe(0 - r.rake);
  });
});
