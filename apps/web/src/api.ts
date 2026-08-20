/**
 * Poker Arena REST client.
 * すべて同一オリジンの相対 URL (`/api/...`) を叩く。
 * 認証は localStorage の API キーを `Authorization: Bearer` に載せる。
 */

import type {
  ApiError,
  BotDetail,
  BotSummary,
  CreateBotRequest,
  CreatePlayRequest,
  DeployVersionRequest,
  HandDetail,
  HandSummary,
  LeaderboardResponse,
  PlayActRequest,
  PlaySession,
  SeasonConfig,
  TableSummary,
  TableView,
} from "@poker-arena/protocol";

// ---------- 資格情報 ----------

const API_KEY_STORAGE = "poker-arena.apiKey";
const OWNER_NAME_STORAGE = "poker-arena.ownerName";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* localStorage が使えない環境では黙って諦める */
  }
}

export function getApiKey(): string | null {
  return readStorage(API_KEY_STORAGE);
}

export function setApiKey(key: string | null): void {
  writeStorage(API_KEY_STORAGE, key);
}

export function getOwnerName(): string | null {
  return readStorage(OWNER_NAME_STORAGE);
}

export function setOwnerName(name: string | null): void {
  writeStorage(OWNER_NAME_STORAGE, name);
}

// ---------- エラー ----------

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "不明なエラーが発生しました";
}

// ---------- 低レベル fetch ----------

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** true なら API キー必須。キーが無ければ即エラー。 */
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, signal } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) headers["Content-Type"] = "application/json";

  const key = getApiKey();
  if (auth) {
    if (!key) throw new ApiRequestError(401, "unauthorized", "API キーが未設定です");
    headers["Authorization"] = `Bearer ${key}`;
  } else if (key) {
    // 匿名でも読める端点でも、自分の bot が判別できるようキーを載せる
    headers["Authorization"] = `Bearer ${key}`;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiRequestError(0, "network_error", "サーバーに接続できません");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const apiError = parsed as Partial<ApiError> | null;
    throw new ApiRequestError(
      res.status,
      apiError?.error ?? "http_error",
      apiError?.message ?? `リクエストに失敗しました (HTTP ${res.status})`,
    );
  }

  return parsed as T;
}

// ---------- 追加の型(docs/API.md の表に対応) ----------

export interface HealthResponse {
  ok: boolean;
  season: SeasonConfig;
  tables: number;
  bots: number;
}

export interface MeResponse {
  id: string;
  name: string;
  /** apiKey はサーバーがハッシュしか保持しないため返らない。発行時の値をクライアントが保持する */
  botLimit: number;
}

export interface SignupResponse {
  id: string;
  name: string;
  apiKey: string;
}

export interface HandListResponse {
  hands: HandSummary[];
  nextCursor: string | null;
}

// ---------- 端点 ----------

export const api = {
  health: (signal?: AbortSignal) => request<HealthResponse>("/api/health", { signal }),

  season: (signal?: AbortSignal) => request<SeasonConfig>("/api/season", { signal }),

  leaderboard: (signal?: AbortSignal) =>
    request<LeaderboardResponse>("/api/leaderboard", { signal }),

  // --- アカウント ---
  signup: (name: string) =>
    request<SignupResponse>("/api/signup", { method: "POST", body: { name } }),

  me: (signal?: AbortSignal) => request<MeResponse>("/api/me", { auth: true, signal }),

  // --- bot ---
  listBots: (signal?: AbortSignal) => request<BotSummary[]>("/api/bots", { auth: true, signal }),

  createBot: (body: CreateBotRequest) =>
    request<BotDetail>("/api/bots", { method: "POST", body, auth: true }),

  getBot: (id: string, signal?: AbortSignal) =>
    request<BotDetail>(`/api/bots/${encodeURIComponent(id)}`, { signal }),

  deployVersion: (id: string, body: DeployVersionRequest) =>
    request<BotDetail>(`/api/bots/${encodeURIComponent(id)}/versions`, {
      method: "POST",
      body,
      auth: true,
    }),

  activateBot: (id: string) =>
    request<BotDetail>(`/api/bots/${encodeURIComponent(id)}/activate`, {
      method: "POST",
      auth: true,
    }),

  deactivateBot: (id: string) =>
    request<BotDetail>(`/api/bots/${encodeURIComponent(id)}/deactivate`, {
      method: "POST",
      auth: true,
    }),

  deleteBot: (id: string) =>
    request<void>(`/api/bots/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),

  // --- テーブル ---
  listTables: (signal?: AbortSignal) => request<TableSummary[]>("/api/tables", { signal }),

  getTable: (id: string, signal?: AbortSignal) =>
    request<TableView>(`/api/tables/${encodeURIComponent(id)}`, { signal }),

  // --- ハンド ---
  listHands: (params: { botId?: string; limit?: number; cursor?: string }, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    if (params.botId) query.set("botId", params.botId);
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.cursor) query.set("cursor", params.cursor);
    const qs = query.toString();
    return request<HandListResponse>(`/api/hands${qs ? `?${qs}` : ""}`, { auth: true, signal });
  },

  getHand: (id: string, signal?: AbortSignal) =>
    request<HandDetail>(`/api/hands/${encodeURIComponent(id)}`, { auth: true, signal }),

  // --- 人間 vs bot ---
  createPlay: (body: CreatePlayRequest) =>
    request<PlaySession>("/api/play", { method: "POST", body }),

  getPlay: (id: string, signal?: AbortSignal) =>
    request<PlaySession>(`/api/play/${encodeURIComponent(id)}`, { signal }),

  act: (id: string, body: PlayActRequest) =>
    request<PlaySession>(`/api/play/${encodeURIComponent(id)}/act`, { method: "POST", body }),

  nextHand: (id: string) =>
    request<PlaySession>(`/api/play/${encodeURIComponent(id)}/next`, { method: "POST" }),
};
