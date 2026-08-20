import type { ActRequest, ActResponse } from "@poker-arena/protocol";
import type { Agent } from "@poker-arena/engine";
import { makeBot, type BotName } from "@poker-arena/simulator";
import { hmacSha256Hex } from "./util.js";

/** UI に出す組み込み戦略。simulator 側に存在するものだけを並べる */
export const BUILTIN_STRATEGIES = ["fold", "call", "random", "aggro", "tight"] as const;

export function isBuiltinStrategy(name: string): boolean {
  try {
    return typeof makeBot(name as BotName, 1) === "function";
  } catch {
    return false;
  }
}

export function builtinAgent(strategy: string, seed: number): Agent {
  const agent = makeBot(strategy as BotName, seed);
  if (typeof agent !== "function") throw new Error(`unknown builtin strategy: ${strategy}`);
  return agent;
}

export interface WebhookOutcome {
  failures: number;
  lastError: string | null;
}

/**
 * Webhook bot を Agent 化する。
 * 応答が不正・遅延・HTTP エラーの場合は例外を投げ、エンジン側で check/fold に強制変換させる。
 */
export function webhookAgent(
  url: string,
  secret: string,
  timeoutMs: number,
  outcome: WebhookOutcome,
): Agent {
  return async (req: ActRequest): Promise<ActResponse> => {
    const body = JSON.stringify(req);
    let res: Response;
    try {
      const signature = await hmacSha256Hex(secret, body);
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-arena-signature": `sha256=${signature}`,
          "x-arena-hand-id": req.hand_id,
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      outcome.failures++;
      outcome.lastError = err instanceof Error ? err.message : "request failed";
      throw err;
    }
    if (!res.ok) {
      outcome.failures++;
      outcome.lastError = `HTTP ${res.status}`;
      throw new Error(outcome.lastError);
    }
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      outcome.failures++;
      outcome.lastError = "response was not valid JSON";
      throw new Error(outcome.lastError);
    }
    const action = parsed as ActResponse;
    if (!action || typeof action !== "object" || typeof (action as { action?: unknown }).action !== "string") {
      outcome.failures++;
      outcome.lastError = "response had no action field";
      throw new Error(outcome.lastError);
    }
    outcome.failures = 0;
    return action;
  };
}
