import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActRequest } from "@poker-arena/protocol";
import { DEFAULT_TIMING, seasonOneConfig } from "@poker-arena/protocol";
import { refillBank, webhookAgent, type TimeBank, type WebhookOutcome } from "../src/agents.js";

const T = DEFAULT_TIMING;

describe("タイムバンクの回復", () => {
  it("ハンドごとに回復し、上限を超えない", () => {
    const bank: TimeBank = { ms: T.bankInitialMs }; // 1000
    refillBank(bank, T.bankRefillPerHandMs, T.bankCapMs);
    expect(bank.ms).toBe(1500);
    // 上限 10000 まで積み上がる
    for (let i = 0; i < 100; i++) refillBank(bank, T.bankRefillPerHandMs, T.bankCapMs);
    expect(bank.ms).toBe(T.bankCapMs);
  });

  it("空になっても負にはならない", () => {
    const bank: TimeBank = { ms: -500 };
    refillBank(bank, T.bankRefillPerHandMs, T.bankCapMs);
    expect(bank.ms).toBe(500);
  });

  it("シーズン1の規定値", () => {
    expect(T.bankInitialMs).toBe(1000);
    expect(T.bankRefillPerHandMs).toBe(500);
    expect(T.bankCapMs).toBe(10000);
  });
});

/** 指定 ms 待ってから応答するテスト用 webhook */
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

describe("タイムバンクの消費", () => {
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

  it("基本時間内に返せばバンクは減らない", async () => {
    const bank: TimeBank = { ms: 1000 };
    const outcome: WebhookOutcome = { failures: 0, lastError: null };
    const agent = webhookAgent(fast.url, "sk_test", 5000, bank, outcome);
    const res = await agent(request);
    expect(res).toEqual({ action: "check" });
    expect(bank.ms).toBe(1000);
    expect(outcome.failures).toBe(0);
  });

  it("基本時間を超えた分だけバンクから引かれる", async () => {
    const bank: TimeBank = { ms: 2000 };
    const outcome: WebhookOutcome = { failures: 0, lastError: null };
    // 基本時間を 100ms に設定 → 400ms 応答なので約 300ms 超過
    const agent = webhookAgent(slow.url, "sk_test", 100, bank, outcome);
    await agent(request);
    expect(bank.ms).toBeLessThan(2000);
    expect(bank.ms).toBeGreaterThan(1400); // 概ね 300ms 前後の消費
    expect(outcome.failures).toBe(0);
  });

  it("バンクが尽きたら基本時間で打ち切られ、失敗として数える", async () => {
    const bank: TimeBank = { ms: 0 };
    const outcome: WebhookOutcome = { failures: 0, lastError: null };
    // 基本 50ms + バンク 0 → 400ms 応答は間に合わない
    const agent = webhookAgent(slow.url, "sk_test", 50, bank, outcome);
    await expect(agent(request)).rejects.toThrow();
    expect(outcome.failures).toBe(1);
    expect(bank.ms).toBe(0);
  });

  it("バンクがあれば基本時間を超える応答も通る", async () => {
    const bank: TimeBank = { ms: 1000 };
    const outcome: WebhookOutcome = { failures: 0, lastError: null };
    // 基本 50ms だがバンク 1000ms があるので 400ms 応答は間に合う
    const agent = webhookAgent(slow.url, "sk_test", 50, bank, outcome);
    const res = await agent(request);
    expect(res).toEqual({ action: "check" });
    expect(bank.ms).toBeLessThan(1000);
    expect(bank.ms).toBeGreaterThan(400);
  });

  it("bot には残り時間とバンク残高が渡る", async () => {
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

    const bank: TimeBank = { ms: 2500 };
    const agent = webhookAgent(`http://127.0.0.1:${port}/`, "sk_test", 5000, bank, {
      failures: 0,
      lastError: null,
    });
    await agent(request);
    server.close();

    expect(received).not.toBeNull();
    expect(received!.time_remaining_ms).toBe(5000);
    expect(received!.time_bank_ms).toBe(2500);
  });
});

describe("webhook bot の停止", () => {
  it("シーズン1では webhook を受け付けない", () => {
    const s = seasonOneConfig("2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    expect(s.webhookBotsEnabled).toBe(false);
  });
});
