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

/** アクションの制限時間とタイムバンク(SPEC §5) */
export interface TimingConfig {
  /** Webhook 型の基本制限時間(ms) */
  baseMsWebhook: number;
  /** アップロード型(サンドボックス)の基本制限時間(ms) */
  baseMsSandbox: number;
  /** タイムバンクの初期値(ms) */
  bankInitialMs: number;
  /** ハンド開始ごとの回復量(ms) */
  bankRefillPerHandMs: number;
  /** タイムバンクの上限(ms) */
  bankCapMs: number;
  /** 連続でこの回数タイムアウト処理されたら自動離席 */
  autoErrorAfter: number;
}

export const DEFAULT_TIMING: TimingConfig = {
  baseMsWebhook: 5000,
  baseMsSandbox: 2000,
  bankInitialMs: 1000,
  bankRefillPerHandMs: 500,
  bankCapMs: 10000,
  autoErrorAfter: 20,
};

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
  /**
   * Webhook 型 bot を受け付けるか。
   * false の間、アリーナは外部への通信を一切行わない(SSRF の面もゼロになる)。
   * 対戦できるのは組み込み戦略の bot のみ。
   */
  webhookBotsEnabled: boolean;
  /** アクションの制限時間 */
  timing: TimingConfig;
}

/**
 * シーズン1(HU)のレーキ。5%、キャップ 0.6bb。
 *
 * 6-max 想定で決めた 4bb キャップは HU では実質的に効かず、レーキが
 * 1人あたり 15bb/100 を超えていた。その結果、実力の近い bot 同士では
 * 勝っている側まで bb/100 がマイナスに沈み、リーダーボードが
 * 「どれだけ弱い相手と当たったか」の指標になっていた。
 * 0.6bb は実測で、現時点の最強 bot が拮抗した相手に対して
 * ちょうど収支ゼロになる水準(`pnpm rake` で再計測できる)。
 */
export const DEFAULT_RAKE: RakeConfig = {
  percent: 5,
  capChips: Math.round(0.6 * CHIPS_PER_BB),
  noFlopNoDrop: true,
};

/** シーズン1: ヘッズアップ NLH、100bb、レーキ 5% cap 0.6bb */
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
    // 当面は外部 fetch を止める。再開するときはここを true にするだけでよい
    webhookBotsEnabled: false,
    timing: DEFAULT_TIMING,
  };
}

export function seatsForFormat(format: GameFormat): number {
  return format === "hu" ? 2 : 6;
}
