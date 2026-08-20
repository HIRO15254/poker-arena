import { describe, expect, it } from "vitest";
import { CHIPS_PER_BB, DEFAULT_RAKE, seasonOneConfig, seatsForFormat } from "../src/index.js";

describe("season config", () => {
  it("レーキ設定に NaN が入らない(循環インポート回帰)", () => {
    // constants.ts を分離する前は index.js との循環参照で capChips が NaN になっていた
    expect(CHIPS_PER_BB).toBe(100);
    expect(DEFAULT_RAKE.capChips).toBe(60); // 0.6bb
    expect(Number.isNaN(DEFAULT_RAKE.capChips)).toBe(false);
    expect(DEFAULT_RAKE.percent).toBe(5);
    expect(DEFAULT_RAKE.noFlopNoDrop).toBe(true);
  });

  it("シーズン1はヘッズアップ 100bb", () => {
    const s = seasonOneConfig("2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    expect(s.format).toBe("hu");
    expect(s.seats).toBe(2);
    expect(s.startingStackBb).toBe(100);
    expect(s.smallBlind).toBe(50);
    expect(s.bigBlind).toBe(100);
    expect(s.rake.capChips).toBe(60);
    expect(JSON.parse(JSON.stringify(s)).rake.capChips).toBe(60);
  });

  it("種目から席数が決まる", () => {
    expect(seatsForFormat("hu")).toBe(2);
    expect(seatsForFormat("6max")).toBe(6);
  });
});
