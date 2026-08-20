// Temporary: play real hands from the authoritative engine against the Python SDK bot.
import { createHmac } from "node:crypto";
import { CHIPS_PER_BB, type ActRequest, type ActResponse } from "../../packages/protocol/src/index.js";
import { playHand, type Agent, type HandConfig } from "../../packages/engine/src/index.js";
import { makeBot } from "../../packages/simulator/src/bots.js";

const URL_ = process.env.BOT_URL ?? "http://127.0.0.1:8097/act";
const SECRET = process.env.BOT_SECRET ?? "s3cr3t";
let calls = 0, errors = 0, forced = 0, maxMs = 0;

const webhook: Agent = async (req: ActRequest): Promise<ActResponse> => {
  const body = JSON.stringify(req);
  const sig = createHmac("sha256", SECRET).update(body).digest("hex");
  calls++;
  const t0 = performance.now();
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", "x-arena-signature": `sha256=${sig}`, "x-arena-hand-id": req.hand_id },
    body,
    signal: AbortSignal.timeout(5000),
  });
  maxMs = Math.max(maxMs, performance.now() - t0);
  if (!res.ok) { errors++; throw new Error(`HTTP ${res.status}`); }
  return (await res.json()) as ActResponse;
};

const hands = Number(process.env.HANDS ?? 200);
const agents = [webhook, makeBot("tight", 7)];
const totals = [0, 0];
const worst: any[] = [];
for (let h = 0; h < hands; h++) {
  const config: HandConfig = {
    handId: `it_${h}`,
    seats: [{ id: "python-sdk", stack: 100 * CHIPS_PER_BB }, { id: "builtin-tight", stack: 100 * CHIPS_PER_BB }],
    button: h % 2,
    smallBlind: CHIPS_PER_BB / 2,
    bigBlind: CHIPS_PER_BB,
    rake: { percent: 5, capChips: 4 * CHIPS_PER_BB, noFlopNoDrop: true },
    seed: 1000 + h,
  };
  const result = await playHand(config, agents);
  result.seats.forEach((s, i) => (totals[i]! += s.net));
  worst.push({ h, net: result.seats[0]!.net, board: result.board.join(" "), hole: result.seats[0]!.holeCards.join(" "),
    vhole: result.seats[1]!.holeCards.join(" "),
    button: config.button,
    log: result.events.filter((e) => e.type === "action").map((e: any) => `${e.record.seat}:${e.record.street}:${e.record.action}${e.record.amount ? "@" + e.record.amount : ""}`).join(" ") });
  for (const e of result.events) {
    if (e.type === "action" && e.record.seat === 0 && e.record.forced) {
      forced++;
      console.log("  FORCED:", JSON.stringify(e.record));
    }
  }
}
console.log(`hands=${hands} webhook calls=${calls} transport errors=${errors} forced actions=${forced} slowest call=${maxMs.toFixed(0)}ms`);
console.log(`  python-sdk    ${(totals[0]! / CHIPS_PER_BB / hands * 100).toFixed(1)} bb/100 (${totals[0]} chips)`);
// aggregate leaks
const agg = new Map<string, { n: number; net: number }>();
const bump = (k: string, net: number) => { const v = agg.get(k) ?? { n: 0, net: 0 }; v.n++; v.net += net; agg.set(k, v); };
for (const w of worst) {
  const pos = w.button === 0 ? "btn" : "bb";
  const heroActs = w.log.split(" ").filter((x: string) => x.startsWith("0:"));
  const foldedPre = heroActs.some((x: string) => x === "0:preflop:fold");
  const sawFlop = heroActs.some((x: string) => x.startsWith("0:flop"));
  const showdown = heroActs.some((x: string) => x.startsWith("0:river")) && !heroActs.includes("0:river:fold");
  bump(`${pos}`, w.net);
  bump(`${pos} ${foldedPre ? "fold-pre" : sawFlop ? "saw-flop" : "won/lost-pre"}`, w.net);
  if (sawFlop) bump(`${pos} ${showdown ? "to-river" : "left-early"}`, w.net);
}
console.log("--- breakdown (hero net, bb) ---");
for (const [k, v] of [...agg].sort()) console.log(`  ${k.padEnd(22)} n=${String(v.n).padStart(4)}  net=${(v.net / 100).toFixed(0)}bb  ${(v.net / 100 / v.n).toFixed(2)}bb/hand`);
worst.sort((a, b) => a.net - b.net);
for (const w of worst.slice(0, 4)) {
  console.log(`  net=${w.net} btn=${w.button} hero=${w.hole} vill=${w.vhole} board=${w.board}\n    ${w.log}`);
}
console.log(`  builtin-tight ${(totals[1]! / CHIPS_PER_BB / hands * 100).toFixed(1)} bb/100 (${totals[1]} chips)`);
