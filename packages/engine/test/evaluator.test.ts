import { describe, expect, it } from "vitest";
import { parseCards } from "../src/cards.js";
import { categoryOf, evaluate5, evaluate7 } from "../src/evaluator.js";

const e5 = (s: string) => evaluate5(parseCards(s));
const e7 = (s: string) => evaluate7(parseCards(s));

describe("evaluate5", () => {
  it("役カテゴリの順序", () => {
    const royal = e5("As Ks Qs Js Ts");
    const quads = e5("9c 9d 9h 9s Ac");
    const boat = e5("8c 8d 8h Kc Kd");
    const flush = e5("2h 7h 9h Jh Ah");
    const straight = e5("5c 6d 7h 8s 9c");
    const trips = e5("7c 7d 7h Ac 2d");
    const twoPair = e5("Ac Ad Kc Kd 2h");
    const pair = e5("Ac Ad 9c 5d 2h");
    const high = e5("Ac Kd 9c 5d 2h");
    const ordered = [royal, quads, boat, flush, straight, trips, twoPair, pair, high];
    for (let i = 0; i < ordered.length - 1; i++) expect(ordered[i]!).toBeGreaterThan(ordered[i + 1]!);
    expect(categoryOf(royal)).toBe("straight flush");
  });

  it("ホイール(A-5)は5ハイストレート", () => {
    const wheel = e5("Ac 2d 3h 4s 5c");
    const sixHigh = e5("2d 3h 4s 5c 6d");
    expect(categoryOf(wheel)).toBe("straight");
    expect(sixHigh).toBeGreaterThan(wheel);
  });

  it("キッカー勝負", () => {
    expect(e5("Ac Ad Kc 5d 2h")).toBeGreaterThan(e5("As Ah Qc 5s 2d"));
    expect(e5("Ac Ad Kc 5d 2h")).toBe(e5("As Ah Ks 5c 2d")); // 同スコアでスプリット
  });
});

describe("evaluate7", () => {
  it("7枚から最強の5枚を選ぶ", () => {
    // ボードのストレートよりホールを使ったフラッシュ
    const score = e7("Ah Kh 2h 7h 9h 8c Tc");
    expect(categoryOf(score)).toBe("flush");
  });

  it("セット > トップペア(デザインモックのハンド)", () => {
    const set = e7("Kc Kh 7h 2c Ks 9s 3d");
    const topPair = e7("As Kd 7h 2c Ks 9s 3d");
    expect(categoryOf(set)).toBe("trips");
    expect(set).toBeGreaterThan(topPair);
  });
});
