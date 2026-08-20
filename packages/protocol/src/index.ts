/**
 * Poker Arena bot プロトコル(SPEC.md §11)。
 * 金額は全てチップ絶対値(1bb = 100)。UI 表示のみ bb 単位に変換する。
 * カードは "As" "Td" "7h" 形式(rank: 23456789TJQKA / suit: cdhs)。
 */

export const CHIPS_PER_BB = 100;

export type Street = "preflop" | "flop" | "turn" | "river";

export type PlayerStatus = "active" | "folded" | "allin";

export interface PlayerState {
  seat: number;
  stack: number;
  bet: number;
  status: PlayerStatus;
}

export type ActionKind =
  | "post_sb"
  | "post_bb"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise";

export interface ActionRecord {
  seat: number;
  street: Street;
  action: ActionKind;
  /** call/bet/raise/blind の額。bet/raise は「そのストリートでの合計額(raise to)」 */
  amount?: number;
  /** アクションの結果オールインになった場合 true */
  all_in?: boolean;
  /** タイムアウト・不正アクションにより check/fold へ強制変換された場合 true */
  forced?: boolean;
}

export type LegalAction =
  | { action: "fold" }
  | { action: "check" }
  | { action: "call"; amount: number }
  | { action: "raise"; min: number; max: number };

/** アリーナ → bot: アクション要求 */
export interface ActRequest {
  type: "act";
  hand_id: string;
  seat: number;
  hole_cards: string[];
  board: string[];
  street: Street;
  pot: number;
  players: PlayerState[];
  actions: ActionRecord[];
  legal_actions: LegalAction[];
  time_remaining_ms?: number;
  time_bank_ms?: number;
}

/** bot → アリーナ: 応答。raise の amount は「raise to」 */
export type ActResponse =
  | { action: "fold" }
  | { action: "check" }
  | { action: "call" }
  | { action: "raise"; amount: number };
