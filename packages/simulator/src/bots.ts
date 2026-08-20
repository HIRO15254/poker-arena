import type { ActRequest, ActResponse } from "@poker-arena/protocol";
import { Agent, mulberry32, parseCard } from "@poker-arena/engine";

/** ベンチマーク bot 群。開発中の bot の強さを段階的に測るための練習相手。 */

const legalOf = (req: ActRequest) => {
  const check = req.legal_actions.find((l) => l.action === "check");
  const call = req.legal_actions.find((l) => l.action === "call");
  const raise = req.legal_actions.find((l) => l.action === "raise");
  return {
    check,
    call: call?.action === "call" ? call : undefined,
    raise: raise?.action === "raise" ? raise : undefined,
  };
};

/** check できるなら check、できなければ fold */
export function checkFoldBot(): Agent {
  return (req) => (legalOf(req).check ? { action: "check" } : { action: "fold" });
}

/** 常に call / check */
export function callBot(): Agent {
  return (req) => {
    const { check, call } = legalOf(req);
    if (call) return { action: "call" };
    if (check) return { action: "check" };
    return { action: "fold" };
  };
}

/** シード付きランダム: check/call 60%、min raise 25%、fold 15% */
export function randomBot(seed: number): Agent {
  const rng = mulberry32(seed);
  return (req): ActResponse => {
    const { check, call, raise } = legalOf(req);
    const r = rng();
    if (raise && r < 0.25) return { action: "raise", amount: raise.min };
    if (r < 0.85) {
      if (call) return { action: "call" };
      if (check) return { action: "check" };
    }
    if (check) return { action: "check" };
    return { action: "fold" };
  };
}

/** 高頻度で min raise、たまにポットサイズレイズ */
export function aggroBot(seed: number): Agent {
  const rng = mulberry32(seed);
  return (req): ActResponse => {
    const { check, call, raise } = legalOf(req);
    if (raise) {
      const r = rng();
      if (r < 0.5) {
        const target = r < 0.15 ? Math.min(raise.max, raise.min + req.pot) : raise.min;
        return { action: "raise", amount: target };
      }
    }
    if (call) return { action: "call" };
    if (check) return { action: "check" };
    return { action: "fold" };
  };
}

/** タイト: 強いスターティングハンドだけ参加、ボードに絡んだら続行 */
export function tightBot(): Agent {
  return (req): ActResponse => {
    const { check, call, raise } = legalOf(req);
    const ranks = req.hole_cards.map((c) => parseCard(c) >> 2).sort((a, b) => b - a);
    const [hi, lo] = [ranks[0]!, ranks[1]!];
    const pair = hi === lo;
    // rank: 12=A 11=K 10=Q 9=J 8=T 7=9 6=8
    const strong = (pair && hi >= 6) || (hi === 12 && lo >= 10); // 88+ / AQ+
    const playable = (pair && hi >= 3) || (hi >= 10 && lo >= 9); // 55+ / QJ+
    if (req.street === "preflop") {
      if (strong && raise) return { action: "raise", amount: raise.min };
      if ((strong || playable) && call && call.amount <= 300) return { action: "call" };
      if (check) return { action: "check" };
      return { action: "fold" };
    }
    // ポストフロップ: ペア以上に絡んでいれば続行
    const boardRanks = req.board.map((c) => parseCard(c) >> 2);
    const connected = pair || ranks.some((r) => boardRanks.includes(r));
    if (connected) {
      if (raise && check) return { action: "raise", amount: raise.min }; // 誰もベットしていなければベット
      if (call) return { action: "call" };
      if (check) return { action: "check" };
    }
    if (check) return { action: "check" };
    return { action: "fold" };
  };
}

export type BotName = "fold" | "call" | "random" | "aggro" | "tight";

export function makeBot(name: BotName, seed: number): Agent {
  switch (name) {
    case "fold":
      return checkFoldBot();
    case "call":
      return callBot();
    case "random":
      return randomBot(seed);
    case "aggro":
      return aggroBot(seed);
    case "tight":
      return tightBot();
  }
}
