/**
 * レーキ設定がリーダーボードに与える影響を測る。
 *
 *   pnpm rake                      # 既定の候補を比較
 *   pnpm rake --hands 20000
 *
 * 見るべきは2つ:
 *  - 実力の近い bot 同士(tight vs balanced)で**両者とも大きく負け越さない**か
 *  - 実力差のあるカード(tight vs random)で強い側がきちんと勝ち越すか
 * レーキが重いとフィールドが強くなるほど全員マイナスに沈み、
 * bb/100 が「相手がどれだけ弱かったか」の指標になってしまう。
 */
import { CHIPS_PER_BB } from "@poker-arena/protocol";
import { playHand, mulberry32, type HandConfig } from "@poker-arena/engine";
import { makeBot, type BotName } from "@poker-arena/simulator";

interface RakeCandidate {
  label: string;
  percent: number;
  /** チップ。0 はレーキなし */
  cap: number;
}

const CANDIDATES: RakeCandidate[] = [
  { label: "5% cap 4.0bb", percent: 5, cap: 400 },
  { label: "5% cap 1.0bb", percent: 5, cap: 100 },
  { label: "5% cap 0.6bb", percent: 5, cap: 60 },
  { label: "5% cap 0.3bb", percent: 5, cap: 30 },
  { label: "2% cap 0.6bb", percent: 2, cap: 60 },
  { label: "レーキなし", percent: 0, cap: 0 },
];

const PAIRS: [BotName, BotName][] = [
  ["tight", "balanced"],
  ["balanced", "lag"],
  ["tight", "random"],
];

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

async function measure(a: BotName, b: BotName, c: RakeCandidate, hands: number) {
  const seedRng = mulberry32(99);
  let netA = 0;
  let netB = 0;
  let rake = 0;
  let rakedHands = 0;
  let cappedHands = 0;

  for (let h = 1; h <= hands; h++) {
    const seed = Math.floor(seedRng() * 2 ** 31);
    const config: HandConfig = {
      handId: `r_${h}`,
      seats: [
        { id: a, stack: 100 * CHIPS_PER_BB },
        { id: b, stack: 100 * CHIPS_PER_BB },
      ],
      button: h % 2,
      smallBlind: CHIPS_PER_BB / 2,
      bigBlind: CHIPS_PER_BB,
      rake: { percent: c.percent, capChips: c.cap, noFlopNoDrop: true },
      seed,
    };
    const r = await playHand(config, [makeBot(a, seed), makeBot(b, seed + 1)]);
    netA += r.seats[0]!.net;
    netB += r.seats[1]!.net;
    rake += r.rake;
    if (r.rake > 0) rakedHands++;
    if (c.cap > 0 && r.rake === c.cap) cappedHands++;
  }

  const bb100 = (n: number) => (n / CHIPS_PER_BB / hands) * 100;
  return {
    a: bb100(netA),
    b: bb100(netB),
    rakeTable: bb100(rake),
    rakedPct: (rakedHands / hands) * 100,
    cappedPct: (cappedHands / hands) * 100,
  };
}

async function main(): Promise<void> {
  const hands = Number(arg("hands", "12000"));
  console.log(`各カード ${hands.toLocaleString()} ハンド、100bb リセット、no flop no drop\n`);

  for (const c of CANDIDATES) {
    console.log(`=== ${c.label} ===`);
    for (const [a, b] of PAIRS) {
      const r = await measure(a, b, c, hands);
      const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`.padStart(7);
      console.log(
        `  ${a.padEnd(8)} ${fmt(r.a)}  ${b.padEnd(8)} ${fmt(r.b)}` +
          `   レーキ ${r.rakeTable.toFixed(1).padStart(5)} bb/100 (1人 ${(r.rakeTable / 2).toFixed(1)})` +
          `   発生 ${r.rakedPct.toFixed(0)}%  上限到達 ${r.cappedPct.toFixed(0)}%`,
      );
    }
    console.log("");
  }
}

await main();
