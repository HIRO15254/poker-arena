import { CHIPS_PER_BB } from "@poker-arena/protocol";
import { Agent, HandConfig, mulberry32, playHand } from "@poker-arena/engine";

export interface SimPlayer {
  id: string;
  agent: Agent;
}

export interface SimOptions {
  hands: number;
  seed: number;
  startingStackBb?: number;
}

export interface SimResult {
  hands: number;
  totals: Map<string, number>; // id → net chips
  bb100: Map<string, number>;
}

/**
 * リーグと同じ条件(毎ハンド 100bb リセット、レーキ 5% cap 4bb)で
 * 固定メンバーのテーブルを回す。ボタンは毎ハンドローテーション。
 */
export async function runSimulation(players: SimPlayer[], opts: SimOptions): Promise<SimResult> {
  const n = players.length;
  const stack = (opts.startingStackBb ?? 100) * CHIPS_PER_BB;
  const totals = new Map<string, number>(players.map((p) => [p.id, 0]));
  const seedRng = mulberry32(opts.seed);

  for (let h = 0; h < opts.hands; h++) {
    const config: HandConfig = {
      handId: `sim_${opts.seed}_${h}`,
      seats: players.map((p) => ({ id: p.id, stack })),
      button: h % n,
      smallBlind: CHIPS_PER_BB / 2,
      bigBlind: CHIPS_PER_BB,
      rake: { percent: 5, capChips: 4 * CHIPS_PER_BB, noFlopNoDrop: true },
      seed: Math.floor(seedRng() * 2 ** 31),
    };
    const result = await playHand(
      config,
      players.map((p) => p.agent),
    );
    for (const s of result.seats) {
      totals.set(s.id, (totals.get(s.id) ?? 0) + s.net);
    }
  }

  const bb100 = new Map<string, number>();
  for (const [id, net] of totals) {
    // bb/100 = (net / CHIPS_PER_BB) / hands * 100
    bb100.set(id, (net / CHIPS_PER_BB / opts.hands) * 100);
  }
  return { hands: opts.hands, totals, bb100 };
}
