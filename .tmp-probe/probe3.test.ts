import { describe, expect, it } from "vitest";
import { parseCards } from "../packages/engine/src/cards.js";
import { Agent, HandConfig, playHand } from "../packages/engine/src/engine.js";
import { makeBot, BOT_NAMES } from "../packages/simulator/src/bots.js";

const RAKE = { percent: 5, capChips: 400, noFlopNoDrop: true };

describe("probe3", () => {
  it("split pot with rake -> both nets negative", async () => {
    // board plays: both have same hand
    const deck = parseCards("2c 2d 3c 3d As Ks Qs Js Th");
    const cfg: HandConfig = { handId: "sp", seats:[{id:"A",stack:10000},{id:"B",stack:10000}],
      button:0, smallBlind:50, bigBlind:100, rake:RAKE, deck };
    const p: Agent = (req:any)=> req.legal_actions.some((l:any)=>l.action==="check")?{action:"check"}:{action:"call"};
    const r = await playHand(cfg,[p,p]);
    console.log("SPLIT board", r.board, "pot", r.totalPot, "rake", r.rake, r.seats.map(s=>[s.id,s.net,s.won,s.showedDown]));
  });

  it("odd chip split goes to BB (out of position) in HU", async () => {
    const deck = parseCards("2c 2d 3c 3d As Ks Qs Js Th");
    const cfg: HandConfig = { handId: "odd", seats:[{id:"A",stack:10000},{id:"B",stack:10000}],
      button:0, smallBlind:50, bigBlind:100, rake:{percent:0,capChips:0,noFlopNoDrop:true}, deck };
    const A = ((): Agent => { let i=0; const a:any[]=[{action:"raise",amount:125}]; return ()=> a[i++] ?? {action:"check"}; })();
    const B: Agent = (req:any)=> req.legal_actions.some((l:any)=>l.action==="check")?{action:"check"}:{action:"call"};
    const r = await playHand(cfg,[A,B]);
    console.log("ODD pot", r.totalPot, r.seats.map(s=>[s.id,s.net,s.won,s.committed]));
  });

  it("chip conservation over many random hands", async () => {
    let bad = 0, worse = 0, total = 0, rakeSum = 0, potSum = 0, matchedRakeSum = 0;
    for (let s = 0; s < 4000; s++) {
      const names = BOT_NAMES;
      const a = makeBot(names[s % names.length]!, s);
      const b = makeBot(names[(s*3+1) % names.length]!, s+7);
      const cfg: HandConfig = { handId: `x${s}`, seats:[{id:"A",stack:10000},{id:"B",stack:10000}],
        button: s%2, smallBlind:50, bigBlind:100, rake:RAKE, seed: s+1 };
      const r = await playHand(cfg,[a,b]);
      total++;
      const sum = r.seats.reduce((x,y)=>x+y.net,0);
      if (sum !== -r.rake) bad++;
      // 正しいレーキ: 実際にマッチしたポット(= 2 * min(committed)) に対して計算
      const matched = 2*Math.min(...r.seats.map(x=>x.committed));
      const correct = r.board.length>=3 ? Math.min(Math.floor(matched*5/100), 400) : 0;
      rakeSum += r.rake; matchedRakeSum += correct; potSum += r.totalPot;
      if (r.rake > correct) worse++;
      // 勝者が負けていないか
      const winner = r.seats.find(x=>!x.folded && x.won>0);
      if (r.seats.filter(x=>!x.folded).length===1 && winner && winner.net < 0) {
        if (bad < 3) console.log("WINNER LOST", JSON.stringify(r.seats), "rake", r.rake, "pot", r.totalPot);
      }
    }
    console.log({total, conservationViolations: bad, overRaked: worse, rakeSum, correctRakeSum: matchedRakeSum,
      extraRakeBb100: ((rakeSum-matchedRakeSum)/100/total)*100});
    expect(bad).toBe(0);
  });
});
