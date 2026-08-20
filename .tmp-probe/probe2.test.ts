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
  return (req:any) => { const a = actions[i++]; if (!a) throw new Error("exhausted " + JSON.stringify(req.legal_actions)); return a; };
}
const deck = parseCards("Ac Kc Ah Kd 2c 7d 9s Ts Jh");

describe("probe2", () => {
  it("flop all-in shove folded to -> rake cap charged to winner", async () => {
    const A = script([{ action: "raise", amount: 250 }, { action: "raise", amount: 9750 }]);
    const B = script([{ action: "call" }, { action: "check" }, { action: "fold" }]);
    const r = await playHand(huConfig({ deck }), [A, B]);
    console.log("SHOVE-FOLD pot", r.totalPot, "rake", r.rake, "nets", r.seats.map(s=>[s.id,s.net]));
    expect(r.seats.reduce((a,s)=>a+s.net,0)).toBe(0 - r.rake);
  });

  it("baseline: limped pot, flop cbet folded", async () => {
    const A = script([{ action: "call" }, { action: "raise", amount: 150 }]);
    const B = script([{ action: "check" }, { action: "check" }, { action: "fold" }]);
    const r = await playHand(huConfig({ deck }), [A, B]);
    console.log("LIMP-CBET pot", r.totalPot, "rake", r.rake, "nets", r.seats.map(s=>[s.id,s.net]));
  });

  it("raise allowed while sole opponent is all-in (3p)", async () => {
    const cfg: HandConfig = { handId: "t3", seats: [{id:"A",stack:10000},{id:"B",stack:10000},{id:"C",stack:400}],
      button: 0, smallBlind: 50, bigBlind: 100, rake: RAKE, deck: parseCards("Ac Kc Qc Ah Kd Qd 2c 7d 9s Ts Jh") };
    const log:any[] = [];
    const mk = (name:string, acts:any[]):Agent => { let i=0; return (req:any)=>{ log.push([name, req.street, JSON.stringify(req.legal_actions)]); const a=acts[i++]; if(!a) throw new Error(name); return a; }; };
    // A raise to 10000 (all-in) preflop, B folds, C is all-in from... actually make C all in and B still able to raise
    const A = mk("A",[{action:"raise",amount:400}]);
    const B = mk("B",[{action:"fold"}]);
    const C = mk("C",[{action:"call"}]);
    const r = await playHand(cfg,[A,B,C]);
    console.log(log.filter(l=>l[0]==="C"||l[0]==="A"));
    console.log("pot", r.totalPot, "rake", r.rake, r.seats.map(s=>[s.id,s.net,s.committed]));
  });

  it("HU: hero can raise vs all-in opponent when opponent covered less (uneven stacks)", async () => {
    const cfg = huConfig({ deck, seats: [{id:"A",stack:10000},{id:"B",stack:3000}] });
    const log:any[]=[];
    const A: Agent = (req:any)=>{ log.push(["A",req.street,JSON.stringify(req.legal_actions)]); return req.legal_actions.some((l:any)=>l.action==="check")?{action:"check"}:{action:"call"}; };
    const B: Agent = (req:any)=>{ log.push(["B",req.street,JSON.stringify(req.legal_actions)]); return {action:"raise", amount:(req.legal_actions.find((l:any)=>l.action==="raise")).max}; };
    const r = await playHand(cfg,[A,B]);
    console.log(log);
    console.log("pot", r.totalPot, "rake", r.rake, r.seats.map(s=>[s.id,s.net,s.committed]));
    expect(r.seats.reduce((a,s)=>a+s.net,0)).toBe(0 - r.rake);
  });
});
