import { describe, expect, it } from "vitest";
import { HandConfig, playHand } from "../packages/engine/src/engine.js";
import { makeBot, BOT_NAMES } from "../packages/simulator/src/bots.js";
import { mulberry32, shuffleInPlace } from "../packages/engine/src/rng.js";
import { freshDeck, cardToString } from "../packages/engine/src/cards.js";
import { mixSeed } from "../apps/server/src/util.js";

const RAKE = { percent: 5, capChips: 400, noFlopNoDrop: true };

describe("probe4", () => {
  it("winner-loses-money frequency + per-seat rake skew", async () => {
    let winnerLost = 0, foldWins = 0, total = 0;
    const extraBySeat = [0,0];
    for (let s = 0; s < 4000; s++) {
      const a = makeBot(BOT_NAMES[s % BOT_NAMES.length]!, s);
      const b = makeBot(BOT_NAMES[(s*3+1) % BOT_NAMES.length]!, s+7);
      const cfg: HandConfig = { handId:`x${s}`, seats:[{id:"A",stack:10000},{id:"B",stack:10000}],
        button:s%2, smallBlind:50, bigBlind:100, rake:RAKE, seed:s+1 };
      const r = await playHand(cfg,[a,b]); total++;
      const alive = r.seats.filter(x=>!x.folded);
      const matched = 2*Math.min(...r.seats.map(x=>x.committed));
      const correct = r.board.length>=3 ? Math.min(Math.floor(matched*5/100),400) : 0;
      const extra = r.rake - correct;
      if (alive.length===1) {
        foldWins++;
        extraBySeat[alive[0]!.seat]! += extra;
        if (alive[0]!.net < 0) { if (winnerLost<3) console.log("WINNER LOST seed",s, JSON.stringify(r.seats.map(x=>[x.id,x.net,x.committed])), "pot",r.totalPot,"rake",r.rake,"correct",correct); winnerLost++; }
      }
    }
    console.log({total, foldWins, winnerLost, extraBySeat});
  });

  it("league deck seed is brute-forceable", () => {
    // league: seed = mixSeed(handNumber, Date.now() & 0xffff)
    const handNumber = 12345, t = 4242;
    const seed = mixSeed(handNumber, t);
    const deck = shuffleInPlace(freshDeck(), mulberry32(seed)).map(cardToString);
    // bot が知る情報: 自分の hole 2枚 (button=1 とすると seat1 = deck[0],deck[2])
    const mine = [deck[0], deck[2]];
    const flop = [deck[4], deck[5], deck[6]];
    let hits = 0; let found: any = null;
    const t0 = Date.now();
    for (let hn = handNumber-50; hn <= handNumber+50; hn++) {
      for (let tt = 0; tt < 65536; tt++) {
        const d = shuffleInPlace(freshDeck(), mulberry32(mixSeed(hn, tt)));
        if (cardToString(d[0]!)===mine[0] && cardToString(d[2]!)===mine[1] &&
            cardToString(d[4]!)===flop[0] && cardToString(d[5]!)===flop[1] && cardToString(d[6]!)===flop[2]) {
          hits++; found = {hn, tt, villain:[cardToString(d[1]!),cardToString(d[3]!)], turn:cardToString(d[7]!), river:cardToString(d[8]!)};
        }
      }
    }
    console.log("brute force ms", Date.now()-t0, "candidates", hits, found, "actual villain", [deck[1],deck[3]], "turn/river", deck[7], deck[8]);
  }, 600000);
});
