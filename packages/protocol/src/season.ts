/** シーズン設定。種目(テーブル人数)はシーズンごとに変わる。 */

import { CHIPS_PER_BB } from "./constants.js";

export type GameFormat = "hu" | "6max";

export interface RakeConfig {
  /** ポットに対する % */
  percent: number;
  /** キャップ(チップ) */
  capChips: number;
  /** フロップが開いていないハンドはレーキなし */
  noFlopNoDrop: boolean;
}

export interface SeasonConfig {
  id: string;
  name: string;
  format: GameFormat;
  /** テーブルの席数。hu=2, 6max=6 */
  seats: number;
  startingStackBb: number;
  smallBlind: number;
  bigBlind: number;
  rake: RakeConfig;
  /** ISO 8601 */
  startsAt: string;
  endsAt: string;
  /** リーダーボード掲載の最低ハンド数 */
  minHandsForLeaderboard: number;
  /** 公式シーズンか(シーズン0 = ベータは非公式) */
  official: boolean;
}

export const DEFAULT_RAKE: RakeConfig = {
  percent: 5,
  capChips: 4 * CHIPS_PER_BB,
  noFlopNoDrop: true,
};

/** シーズン1: ヘッズアップ NLH、100bb、レーキ 5% cap 4bb */
export function seasonOneConfig(startsAt: string, endsAt: string): SeasonConfig {
  return {
    id: "s1",
    name: "Season 1 — Heads-Up NLH",
    format: "hu",
    seats: 2,
    startingStackBb: 100,
    smallBlind: CHIPS_PER_BB / 2,
    bigBlind: CHIPS_PER_BB,
    rake: DEFAULT_RAKE,
    startsAt,
    endsAt,
    minHandsForLeaderboard: 10_000,
    official: true,
  };
}

export function seatsForFormat(format: GameFormat): number {
  return format === "hu" ? 2 : 6;
}
