import { BotName, makeBot } from "./bots.js";
import { runSimulation } from "./run.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const hands = Number(arg("hands", "1000"));
const seed = Number(arg("seed", "1"));
const lineup = arg("bots", "tight,aggro,call,random,random,fold").split(",") as BotName[];

if (lineup.length < 2 || lineup.length > 6) {
  console.error("--bots はカンマ区切りで 2〜6 体 (fold/call/random/aggro/tight)");
  process.exit(1);
}

const players = lineup.map((name, i) => ({
  id: `${name}-${i}`,
  agent: makeBot(name, seed * 1000 + i),
}));

const started = performance.now();
const result = await runSimulation(players, { hands, seed });
const elapsed = performance.now() - started;

console.log(`hands: ${hands}  seed: ${seed}  (${elapsed.toFixed(0)}ms)`);
console.log("");
const rows = [...result.bb100.entries()].sort((a, b) => b[1] - a[1]);
const width = Math.max(...rows.map(([id]) => id.length));
for (const [id, v] of rows) {
  const chips = result.totals.get(id)!;
  console.log(`${id.padEnd(width)}  ${v >= 0 ? "+" : ""}${v.toFixed(1)} bb/100  (${chips} chips)`);
}
