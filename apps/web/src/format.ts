/**
 * 表示用のフォーマッタ。
 * API はすべてチップ絶対値を返す。金額の表示は必ず bb に変換する(1bb = 100 チップ)。
 */

import { CHIPS_PER_BB } from "@poker-arena/protocol";
import type { Street } from "@poker-arena/protocol";

export { CHIPS_PER_BB };

export function chipsToBb(chips: number): number {
  return chips / CHIPS_PER_BB;
}

export function bbToChips(bb: number): number {
  return Math.round(bb * CHIPS_PER_BB);
}

/** チップ → "97.5" */
export function bb(chips: number, digits = 1): string {
  return chipsToBb(chips).toFixed(digits);
}

/** チップ → "97.5bb" */
export function bbLabel(chips: number, digits = 1): string {
  return `${bb(chips, digits)}bb`;
}

/** チップ → "+8.2" / "-4.1" */
export function signedBb(chips: number, digits = 1): string {
  const value = chipsToBb(chips);
  return `${value > 0 ? "+" : value < 0 ? "" : "±"}${value.toFixed(digits)}`;
}

/** bb/100 など、既に bb 単位の数値に符号を付ける */
export function signedNumber(value: number, digits = 1): string {
  return `${value > 0 ? "+" : value < 0 ? "" : "±"}${value.toFixed(digits)}`;
}

/** 正なら success、負なら destructive のクラス名 */
export function signClass(value: number): string {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "zero";
}

export function integer(value: number): string {
  return value.toLocaleString("en-US");
}

export function initials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9぀-ヿ一-龯]/g, "");
  if (cleaned.length === 0) return "??";
  return cleaned.slice(0, 2).toLowerCase();
}

const STREET_LABEL: Record<Street, string> = {
  preflop: "プリフロップ",
  flop: "フロップ",
  turn: "ターン",
  river: "リバー",
};

export const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

export function streetLabel(street: Street): string {
  return STREET_LABEL[street];
}

/** そのストリートで新しく開いたボードカード */
export function streetCards(street: Street, board: string[]): string[] {
  switch (street) {
    case "preflop":
      return [];
    case "flop":
      return board.slice(0, 3);
    case "turn":
      return board.slice(3, 4);
    case "river":
      return board.slice(4, 5);
  }
}

export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("ja-JP", { hour12: false });
}

export function dateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-------_--";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dateOnly(iso)} ${hh}:${mm}`;
}
