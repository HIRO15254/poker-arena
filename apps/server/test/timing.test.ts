import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActRequest } from "@poker-arena/protocol";
import { DEFAULT_TIMING, seasonOneConfig } from "@poker-arena/protocol";
import { webhookAgent, type WebhookOutcome } from "../src/agents.js";
import { handsPerPair } from "../src/league.js";

describe("持ち時間は一定", () => {
  it("シーズン1は 1 アクション 1000ms、タイムバンクなし", () => {
    expect(DEFAULT_TIMING.actionMs).toBe(1000);
    expect(DEFAULT_TIMING.autoErrorAfter).toBe(20);
    // バンク関連の設定は存在しない
    expect(Object.keys(DEFAULT_TIMING).sort()).toEqual(["actionMs", "autoErrorAfter"]);
  });

  it("シーズン設定にも反映される", () => {
    const s = seasonOneConfig("2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    expect(s.timing.actionMs).toBe(1000);
  });
});

function delayedServer(delayMs: number): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        setTimeout(() => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ action: "check" }));
        }, delayMs);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

const request: ActRequest = {
  type: "act",
  hand_id: "h_test",
  seat: 0,
  hole_cards: ["As", "Kd"],
  board: [],
  street: "preflop",
  pot: 150,
  players: [
    { seat: 0, stack: 9950, bet: 50, status: "active" },
    { seat: 1, stack: 9900, bet: 100, status: "active" },
  ],
  actions: [],
  legal_actions: [{ action: "fold" }, { action: "call", amount: 50 }],
};

describe("持ち時間の打ち切り", () => {
  let fast: { server: Server; url: string };
  let slow: { server: Server; url: string };
  beforeAll(async () => {
    fast = await delayedServer(10);
    slow = await delayedServer(400);
  });
  afterAll(() => {
    fast.server.close();
    slow.server.close();
  });

  it("時間内に返せば通る", async () => {
    const outcome: WebhookOutcome = { failures: 0, lastError: null };
    const agent = webhookAgent(fast.url, "sk_test", 1000, outcome);
    expect(await agent(request)).toEqual({ action: "check" });
    expect(outcome.failures).toBe(0);
  });

  it("超えたら打ち切り、失敗として数える", async () => {
    const outcome: WebhookOutcome = { failures: 0, lastError: null };
    const agent = webhookAgent(slow.url, "sk_test", 100, outcome);
    await expect(agent(request)).rejects.toThrow();
    expect(outcome.failures).toBe(1);
  });

  it("bot には一定の残り時間が渡る(バンク残高は渡らない)", async () => {
    let received: ActRequest | null = null;
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received = JSON.parse(body);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ action: "fold" }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    await webhookAgent(`http://127.0.0.1:${port}/`, "sk_test", 1000, { failures: 0, lastError: null })(request);
    server.close();
    expect(received!.time_remaining_ms).toBe(1000);
    expect(received!.time_bank_ms).toBeUndefined();
  });
});

describe("対戦量の規則", () => {
  it("相手が10体なら1ペア1000ハンド = 1体あたり10,000ハンド", () => {
    expect(handsPerPair(10)).toBe(1000);
    expect(handsPerPair(10) * 10).toBe(10_000);
  });

  it("相手が少ないときは1ペアの上限 1000 で頭打ち", () => {
    expect(handsPerPair(1)).toBe(1000);
    expect(handsPerPair(6)).toBe(1000);
    // 7 体相手なら 7,000 ハンド(10,000 には届かないが 1 ペア 1000 は守る)
    expect(handsPerPair(7) * 7).toBe(7000);
  });

  it("参加者が増えても1体あたり10,000ハンドを超えない", () => {
    for (const opponents of [10, 20, 50, 100]) {
      expect(handsPerPair(opponents) * opponents).toBeLessThanOrEqual(10_000);
    }
    expect(handsPerPair(20)).toBe(500);
    expect(handsPerPair(100)).toBe(100);
  });

  it("相手がいなければ0", () => {
    expect(handsPerPair(0)).toBe(0);
  });
});
