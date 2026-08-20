import { Card } from "./cards.js";

/**
 * 5枚役の評価。大きいほど強い。
 * score = ((((category*13 + t1)*13 + t2)*13 + t3)*13 + t4)*13 + t5
 * category: 8=SF 7=quads 6=full house 5=flush 4=straight 3=trips 2=two pair 1=pair 0=high card
 */
export function evaluate5(cards: readonly Card[]): number {
  const ranks = cards.map((c) => c >> 2).sort((a, b) => b - a);
  const suits = cards.map((c) => c & 3);
  const isFlush = suits.every((s) => s === suits[0]);

  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = -1;
  if (uniq.length === 5) {
    if (uniq[0]! - uniq[4]! === 4) straightHigh = uniq[0]!;
    // wheel: A(12) 5(3) 4(2) 3(1) 2(0) → 5-high
    else if (uniq[0] === 12 && uniq[1] === 3 && uniq[4] === 0) straightHigh = 3;
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // (枚数, ランク) の降順
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let category: number;
  let tiebreak: number[];
  if (straightHigh >= 0 && isFlush) {
    category = 8;
    tiebreak = [straightHigh];
  } else if (groups[0]![1] === 4) {
    category = 7;
    tiebreak = [groups[0]![0], groups[1]![0]];
  } else if (groups[0]![1] === 3 && groups[1]![1] === 2) {
    category = 6;
    tiebreak = [groups[0]![0], groups[1]![0]];
  } else if (isFlush) {
    category = 5;
    tiebreak = ranks;
  } else if (straightHigh >= 0) {
    category = 4;
    tiebreak = [straightHigh];
  } else if (groups[0]![1] === 3) {
    category = 3;
    tiebreak = [groups[0]![0], groups[1]![0], groups[2]![0]];
  } else if (groups[0]![1] === 2 && groups[1]![1] === 2) {
    category = 2;
    tiebreak = [groups[0]![0], groups[1]![0], groups[2]![0]];
  } else if (groups[0]![1] === 2) {
    category = 1;
    tiebreak = [groups[0]![0], groups[1]![0], groups[2]![0], groups[3]![0]];
  } else {
    category = 0;
    tiebreak = ranks;
  }

  let score = category;
  for (let i = 0; i < 5; i++) score = score * 13 + (tiebreak[i] ?? 0);
  return score;
}

// 7C5 = 21 通りの5枚組インデックス
const COMBOS_7C5: number[][] = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++)
          for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
  return out;
})();

/** 7枚(ホール2+ボード5)から最強5枚の評価値を返す */
export function evaluate7(cards: readonly Card[]): number {
  if (cards.length !== 7) throw new Error(`evaluate7 expects 7 cards, got ${cards.length}`);
  let best = -1;
  const buf: Card[] = [0, 0, 0, 0, 0];
  for (const combo of COMBOS_7C5) {
    for (let i = 0; i < 5; i++) buf[i] = cards[combo[i]!]!;
    const s = evaluate5(buf);
    if (s > best) best = s;
  }
  return best;
}

const CATEGORY_NAMES = [
  "high card",
  "pair",
  "two pair",
  "trips",
  "straight",
  "flush",
  "full house",
  "quads",
  "straight flush",
] as const;

export function categoryOf(score: number): (typeof CATEGORY_NAMES)[number] {
  return CATEGORY_NAMES[Math.floor(score / 13 ** 5)]!;
}
