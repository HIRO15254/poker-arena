import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  CHIPS_PER_BB,
  type ActResponse,
  type BotDetail,
  type BotSummary,
  type HandDetail,
  type HandSummary,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type TableSummary,
  type TableView,
} from "@poker-arena/protocol";
import { playHand, type Agent, type HandConfig } from "@poker-arena/engine";
import type { Env } from "./env.js";
import { currentSeason } from "./season.js";
import { BUILTIN_STRATEGIES, builtinAgent, isBuiltinStrategy } from "./agents.js";
import { ensureBuiltins, runLeagueBatch } from "./league.js";
import { buildSession, buttonForHand, validateAction } from "./play.js";
import {
  getBot, getStats, getUserByApiKeyHash, listBotsByOwner,
  type BotRow, type PlayRow, type StoredSeat,
} from "./store.js";
import { computeRating, mixSeed, newApiKey, newId, newSecret, nowIso, sha256Hex } from "./util.js";

type Vars = { userId: string; userName: string };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("/api/*", cors());

const fail = (status: 400 | 401 | 403 | 404 | 409 | 429, error: string, message: string) =>
  Response.json({ error, message }, { status });

async function requireUser(c: { req: { header: (k: string) => string | undefined }; env: Env }) {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  return getUserByApiKeyHash(c.env.DB, await sha256Hex(token));
}

const auth = async (c: any, next: any) => {
  const user = await requireUser(c);
  if (!user) return fail(401, "unauthorized", "API キーが必要です");
  c.set("userId", user.id);
  c.set("userName", user.name);
  await next();
};

// ---------- 公開エンドポイント ----------

app.get("/api/health", async (c) => {
  const season = currentSeason();
  const bots = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM bots").first<{ n: number }>();
  const tables = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tables").first<{ n: number }>();
  const hands = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM hands").first<{ n: number }>();
  return c.json({ ok: true, season, bots: bots?.n ?? 0, tables: tables?.n ?? 0, hands: hands?.n ?? 0 });
});

app.get("/api/season", (c) => c.json(currentSeason()));

app.get("/api/builtins", (c) => c.json({ strategies: BUILTIN_STRATEGIES }));

interface LeaderRow extends BotRow {
  owner_name: string;
  hands: number | null;
  net_chips: number | null;
  sum_sq_bb: number | null;
}

function toSummary(row: LeaderRow): BotSummary {
  const hands = row.hands ?? 0;
  const net = row.net_chips ?? 0;
  const { bb100, ci95 } = computeRating(hands, net, row.sum_sq_bb ?? 0, CHIPS_PER_BB);
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    kind: row.kind as BotSummary["kind"],
    status: row.status as BotSummary["status"],
    version: row.version,
    hands,
    netChips: net,
    bb100,
    ci95,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.get("/api/leaderboard", async (c) => {
  const season = currentSeason();
  const res = await c.env.DB.prepare(
    `SELECT b.*, u.name AS owner_name, s.hands, s.net_chips, s.sum_sq_bb
     FROM bots b
     JOIN users u ON u.id = b.owner_id
     LEFT JOIN season_stats s
       ON s.bot_id = b.id AND s.version = b.version AND s.season_id = ?`,
  ).bind(season.id).all<LeaderRow>();

  const summaries = (res.results ?? []).map(toSummary);
  summaries.sort((a, b) => {
    const aq = a.hands >= season.minHandsForLeaderboard ? 1 : 0;
    const bq = b.hands >= season.minHandsForLeaderboard ? 1 : 0;
    if (aq !== bq) return bq - aq;
    return b.bb100 - a.bb100;
  });
  const entries: LeaderboardEntry[] = summaries.map((s, i) => ({
    ...s,
    rank: i + 1,
    qualified: s.hands >= season.minHandsForLeaderboard,
  }));
  const body: LeaderboardResponse = {
    season,
    entries,
    totalBots: entries.length,
    updatedAt: nowIso(),
  };
  return c.json(body);
});

// ---------- ユーザー ----------

app.post("/api/signup", async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
  const name = (body.name ?? "").trim();
  if (!name || name.length > 40) return fail(400, "invalid_request", "name は 1〜40 文字で指定してください");
  const apiKey = newApiKey();
  const id = newId("usr");
  await c.env.DB.prepare("INSERT INTO users (id, name, api_key_hash, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, name, await sha256Hex(apiKey), nowIso())
    .run();
  return c.json({ id, name, apiKey, botLimit: 3 });
});

app.get("/api/me", auth, async (c) => {
  return c.json({ id: c.get("userId"), name: c.get("userName"), botLimit: 3 });
});

// ---------- bot ----------

async function botToDetail(env: Env, row: BotRow, ownerName: string, includePrivate: boolean): Promise<BotDetail> {
  const season = currentSeason();
  const stats = await getStats(env.DB, season.id, row.id, row.version);
  const summary = toSummary({
    ...row,
    owner_name: ownerName,
    hands: stats?.hands ?? 0,
    net_chips: stats?.net_chips ?? 0,
    sum_sq_bb: stats?.sum_sq_bb ?? 0,
  });
  const versionsRes = await env.DB.prepare(
    "SELECT version, hands, net_chips, updated_at FROM season_stats WHERE season_id = ? AND bot_id = ? ORDER BY version DESC",
  ).bind(season.id, row.id).all<{ version: number; hands: number; net_chips: number; updated_at: string }>();

  const detail: BotDetail = {
    ...summary,
    versions: (versionsRes.results ?? []).map((v) => ({
      version: v.version,
      deployedAt: v.updated_at,
      hands: v.hands,
      netChips: v.net_chips,
      bb100: v.hands > 0 ? (v.net_chips / CHIPS_PER_BB / v.hands) * 100 : 0,
    })),
  };
  if (includePrivate) {
    detail.webhookUrl = row.webhook_url ?? undefined;
    detail.builtinStrategy = row.builtin_strategy ?? undefined;
    detail.lastError = row.last_error ? { message: row.last_error, at: row.last_error_at ?? "" } : null;
    const timelineRes = await env.DB.prepare(
      "SELECT hands, bb100 FROM stat_timeline WHERE season_id = ? AND bot_id = ? AND version = ? ORDER BY hands LIMIT 200",
    ).bind(season.id, row.id, row.version).all<{ hands: number; bb100: number }>();
    if (stats) {
      detail.stats = {
        hands: stats.hands,
        bb100: summary.bb100,
        vpip: stats.hands > 0 ? (stats.vpip_hands / stats.hands) * 100 : 0,
        pfr: stats.hands > 0 ? (stats.pfr_hands / stats.hands) * 100 : 0,
        wtsd: stats.hands > 0 ? (stats.showdown_hands / stats.hands) * 100 : 0,
        wonAtShowdown: stats.showdown_hands > 0 ? (stats.won_showdown / stats.showdown_hands) * 100 : 0,
        byPosition: {
          btn: {
            hands: stats.btn_hands,
            bb100: stats.btn_hands > 0 ? (stats.btn_net / CHIPS_PER_BB / stats.btn_hands) * 100 : 0,
          },
          bb: {
            hands: stats.bb_hands,
            bb100: stats.bb_hands > 0 ? (stats.bb_net / CHIPS_PER_BB / stats.bb_hands) * 100 : 0,
          },
        },
        timeline: timelineRes.results ?? [],
      };
    }
  }
  return detail;
}

app.get("/api/bots", auth, async (c) => {
  const rows = await listBotsByOwner(c.env.DB, c.get("userId"));
  const season = currentSeason();
  const out: BotSummary[] = [];
  for (const row of rows) {
    const stats = await getStats(c.env.DB, season.id, row.id, row.version);
    out.push(
      toSummary({
        ...row,
        owner_name: c.get("userName"),
        hands: stats?.hands ?? 0,
        net_chips: stats?.net_chips ?? 0,
        sum_sq_bb: stats?.sum_sq_bb ?? 0,
      }),
    );
  }
  return c.json(out);
});

app.post("/api/bots", auth, async (c) => {
  const body = await c.req.json<{ name?: string; kind?: string; webhookUrl?: string; builtinStrategy?: string }>()
    .catch(() => ({}) as { name?: string; kind?: string; webhookUrl?: string; builtinStrategy?: string });
  const name = (body.name ?? "").trim();
  if (!name || name.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return fail(400, "invalid_request", "name は英数字・ハイフン・アンダースコア 32 文字以内");
  }
  const kind = body.kind === "builtin" ? "builtin" : "webhook";
  if (kind === "webhook") {
    if (!body.webhookUrl || !/^https:\/\//.test(body.webhookUrl)) {
      return fail(400, "invalid_request", "webhookUrl は https:// で始まる URL が必要です");
    }
  } else if (!body.builtinStrategy || !isBuiltinStrategy(body.builtinStrategy)) {
    return fail(400, "invalid_request", `builtinStrategy は ${BUILTIN_STRATEGIES.join(" / ")} のいずれか`);
  }

  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM bots WHERE owner_id = ?")
    .bind(c.get("userId")).first<{ n: number }>();
  if ((count?.n ?? 0) >= 3) return fail(409, "conflict", "bot は 1 ユーザー 3 個までです");

  const dup = await c.env.DB.prepare("SELECT id FROM bots WHERE name = ?").bind(name).first();
  if (dup) return fail(409, "conflict", "その名前の bot は既に存在します");

  const id = newId("bot");
  const secret = newSecret();
  const at = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO bots (id, owner_id, name, kind, webhook_url, builtin_strategy, secret, status, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', 1, ?, ?)`,
  ).bind(id, c.get("userId"), name, kind, body.webhookUrl ?? null, body.builtinStrategy ?? null, secret, at, at).run();

  const row = await getBot(c.env.DB, id);
  const detail = await botToDetail(c.env, row!, c.get("userName"), true);
  return c.json({ ...detail, secret });
});

async function ownedBot(c: any): Promise<BotRow | Response> {
  const row = await getBot(c.env.DB, c.req.param("id"));
  if (!row) return fail(404, "not_found", "bot が見つかりません");
  if (row.owner_id !== c.get("userId")) return fail(403, "forbidden", "自分の bot ではありません");
  return row;
}

app.get("/api/bots/:id", async (c) => {
  const row = await getBot(c.env.DB, c.req.param("id"));
  if (!row) return fail(404, "not_found", "bot が見つかりません");
  const owner = await c.env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(row.owner_id).first<{ name: string }>();
  const user = await requireUser(c as any);
  const mine = user?.id === row.owner_id;
  return c.json(await botToDetail(c.env, row, owner?.name ?? "unknown", mine));
});

app.post("/api/bots/:id/versions", auth, async (c) => {
  const row = await ownedBot(c);
  if (row instanceof Response) return row;
  const body = await c.req.json<{ webhookUrl?: string; builtinStrategy?: string; note?: string }>()
    .catch(() => ({}) as { webhookUrl?: string; builtinStrategy?: string; note?: string });
  const at = nowIso();
  await c.env.DB.prepare(
    `UPDATE bots SET version = version + 1, webhook_url = COALESCE(?, webhook_url),
       builtin_strategy = COALESCE(?, builtin_strategy), consecutive_failures = 0,
       last_error = NULL, last_error_at = NULL, updated_at = ? WHERE id = ?`,
  ).bind(body.webhookUrl ?? null, body.builtinStrategy ?? null, at, row.id).run();
  const updated = await getBot(c.env.DB, row.id);
  return c.json(await botToDetail(c.env, updated!, c.get("userName"), true));
});

for (const [path, status] of [["activate", "active"], ["deactivate", "idle"]] as const) {
  app.post(`/api/bots/:id/${path}`, auth, async (c) => {
    const row = await ownedBot(c);
    if (row instanceof Response) return row;
    await c.env.DB.prepare(
      "UPDATE bots SET status = ?, consecutive_failures = 0, updated_at = ? WHERE id = ?",
    ).bind(status, nowIso(), row.id).run();
    const updated = await getBot(c.env.DB, row.id);
    return c.json(await botToDetail(c.env, updated!, c.get("userName"), true));
  });
}

app.delete("/api/bots/:id", auth, async (c) => {
  const row = await ownedBot(c);
  if (row instanceof Response) return row;
  await c.env.DB.prepare("DELETE FROM bots WHERE id = ?").bind(row.id).run();
  return c.json({ ok: true });
});

// ---------- テーブル(観戦) ----------

interface TableRow {
  id: string; bot_a: string; bot_b: string; hand_number: number; last_hand_id: string | null; updated_at: string;
}

app.get("/api/tables", async (c) => {
  const res = await c.env.DB.prepare(
    "SELECT * FROM tables ORDER BY updated_at DESC LIMIT 40",
  ).all<TableRow>();
  const out: TableSummary[] = [];
  for (const t of res.results ?? []) {
    const names = await c.env.DB.prepare("SELECT id, name FROM bots WHERE id IN (?, ?)")
      .bind(t.bot_a, t.bot_b).all<{ id: string; name: string }>();
    out.push({
      id: t.id,
      format: "hu",
      street: "preflop",
      handNumber: t.hand_number,
      seatedBots: (names.results ?? []).map((n) => n.name),
      occupancy: "2/2",
    });
  }
  return c.json(out);
});

app.get("/api/tables/:id", async (c) => {
  const t = await c.env.DB.prepare("SELECT * FROM tables WHERE id = ?").bind(c.req.param("id")).first<TableRow>();
  if (!t) return fail(404, "not_found", "テーブルが見つかりません");
  const hand = t.last_hand_id
    ? await c.env.DB.prepare("SELECT * FROM hands WHERE id = ?").bind(t.last_hand_id).first<any>()
    : null;
  if (!hand) return fail(404, "not_found", "まだハンドがありません");
  const seats = JSON.parse(hand.seats) as StoredSeat[];
  const board = JSON.parse(hand.board) as string[];
  const view: TableView = {
    id: t.id,
    format: "hu",
    handId: hand.id,
    handNumber: hand.hand_number,
    street: board.length >= 5 ? "river" : board.length === 4 ? "turn" : board.length === 3 ? "flop" : "preflop",
    board,
    pot: hand.pot,
    seats: seats.map((s) => ({
      seat: s.seat,
      botId: s.botId,
      botName: s.botName,
      ownerName: s.ownerName,
      stack: s.startingStack + s.net,
      bet: 0,
      status: s.showedDown ? ("active" as const) : ("folded" as const),
      cards: s.showedDown ? s.holeCards : undefined,
      isButton: s.seat === hand.button,
      toAct: false,
    })),
    actions: JSON.parse(hand.actions),
    spectators: 0,
    updatedAt: t.updated_at,
  };
  return c.json(view);
});

// ---------- ハンド履歴 ----------

app.get("/api/hands", auth, async (c) => {
  const botId = c.req.query("botId");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  if (!botId) return fail(400, "invalid_request", "botId が必要です");
  const bot = await getBot(c.env.DB, botId);
  if (!bot) return fail(404, "not_found", "bot が見つかりません");
  if (bot.owner_id !== c.get("userId")) return fail(403, "forbidden", "自分の bot ではありません");

  const res = await c.env.DB.prepare(
    `SELECT h.*, hs.seat AS my_seat, hs.net AS my_net
     FROM hand_seats hs JOIN hands h ON h.id = hs.hand_id
     WHERE hs.bot_id = ? ORDER BY hs.played_at DESC LIMIT ?`,
  ).bind(botId, limit).all<any>();

  const hands: HandSummary[] = (res.results ?? []).map((h) => {
    const seats = JSON.parse(h.seats) as StoredSeat[];
    const mine = seats.find((s) => s.seat === h.my_seat);
    return {
      handId: h.id,
      tableId: h.table_id,
      playedAt: h.played_at,
      seat: h.my_seat,
      position: h.my_seat === h.button ? "btn" : "bb",
      holeCards: mine?.holeCards ?? [],
      board: JSON.parse(h.board),
      net: h.my_net,
      potSize: h.pot,
      wentToShowdown: seats.some((s) => s.showedDown),
      opponents: seats.filter((s) => s.seat !== h.my_seat).map((s) => ({ seat: s.seat, botName: s.botName })),
    };
  });
  return c.json({ hands, nextCursor: null });
});

app.get("/api/hands/:handId", auth, async (c) => {
  const h = await c.env.DB.prepare("SELECT * FROM hands WHERE id = ?").bind(c.req.param("handId")).first<any>();
  if (!h) return fail(404, "not_found", "ハンドが見つかりません");
  const seats = JSON.parse(h.seats) as StoredSeat[];
  const mineRow = await c.env.DB.prepare(
    `SELECT hs.seat FROM hand_seats hs JOIN bots b ON b.id = hs.bot_id
     WHERE hs.hand_id = ? AND b.owner_id = ?`,
  ).bind(h.id, c.get("userId")).first<{ seat: number }>();
  if (!mineRow) return fail(403, "forbidden", "このハンドは自分の bot のものではありません");

  const board = JSON.parse(h.board) as string[];
  const mine = seats.find((s) => s.seat === mineRow.seat);
  const detail: HandDetail = {
    handId: h.id,
    tableId: h.table_id,
    playedAt: h.played_at,
    seat: mineRow.seat,
    position: mineRow.seat === h.button ? "btn" : "bb",
    holeCards: mine?.holeCards ?? [],
    board,
    net: mine?.net ?? 0,
    potSize: h.pot,
    wentToShowdown: seats.some((s) => s.showedDown),
    opponents: seats.filter((s) => s.seat !== mineRow.seat).map((s) => ({ seat: s.seat, botName: s.botName })),
    seats: seats.map((s) => ({
      seat: s.seat,
      botName: s.botName,
      startingStack: s.startingStack,
      // 自分視点: 相手のカードはショーダウン公開分のみ
      holeCards: s.seat === mineRow.seat || s.showedDown ? s.holeCards : null,
      net: s.net,
    })),
    actions: JSON.parse(h.actions),
    streets: [
      { street: "preflop", board: [] },
      { street: "flop", board: board.slice(0, 3) },
      { street: "turn", board: board.slice(0, 4) },
      { street: "river", board: board.slice(0, 5) },
    ].filter((s) => s.street === "preflop" || s.board.length > 0) as HandDetail["streets"],
    rake: h.rake,
    smallBlind: h.small_blind,
    bigBlind: h.big_blind,
    button: h.button,
  };
  return c.json(detail);
});

// ---------- テストマッチ ----------

app.post("/api/test-match", auth, async (c) => {
  const body = await c.req.json<{ botId?: string; opponent?: string; hands?: number; seed?: number }>()
    .catch(() => ({}) as { botId?: string; opponent?: string; hands?: number; seed?: number });
  const bot = body.botId ? await getBot(c.env.DB, body.botId) : null;
  if (!bot) return fail(404, "not_found", "bot が見つかりません");
  if (bot.owner_id !== c.get("userId")) return fail(403, "forbidden", "自分の bot ではありません");
  const opponent = body.opponent ?? "call";
  if (!isBuiltinStrategy(opponent)) return fail(400, "invalid_request", "opponent は組み込み戦略名を指定してください");
  if (bot.kind === "webhook") return fail(400, "invalid_request", "webhook bot のテストマッチは未対応です");

  const season = currentSeason();
  const seed = body.seed ?? 1;
  const hands = Math.min(Math.max(Number(body.hands ?? 500), 1), 2000);
  const started = Date.now();
  let netA = 0;
  for (let i = 1; i <= hands; i++) {
    const handSeed = mixSeed(seed, i);
    const config: HandConfig = {
      handId: `test_${seed}_${i}`,
      seats: [
        { id: bot.name, stack: season.startingStackBb * CHIPS_PER_BB },
        { id: opponent, stack: season.startingStackBb * CHIPS_PER_BB },
      ],
      button: buttonForHand(i),
      smallBlind: season.smallBlind,
      bigBlind: season.bigBlind,
      rake: season.rake,
      seed: handSeed,
    };
    const agents: Agent[] = [
      builtinAgent(bot.builtin_strategy ?? "call", handSeed),
      builtinAgent(opponent, handSeed + 1),
    ];
    const result = await playHand(config, agents);
    netA += result.seats[0]?.net ?? 0;
  }
  return c.json({
    hands,
    results: [
      { id: bot.name, netChips: netA, bb100: (netA / CHIPS_PER_BB / hands) * 100 },
      { id: opponent, netChips: -netA, bb100: (-netA / CHIPS_PER_BB / hands) * 100 },
    ],
    sampleHandIds: [],
    durationMs: Date.now() - started,
  });
});

// ---------- 人間 vs bot ----------

app.post("/api/play", async (c) => {
  const body = await c.req.json<{ opponent?: string }>().catch(() => ({}) as { opponent?: string });
  const opponent = body.opponent ?? "tight";
  if (!isBuiltinStrategy(opponent)) {
    return fail(400, "invalid_request", `opponent は ${BUILTIN_STRATEGIES.join(" / ")} のいずれか`);
  }
  const id = newId("play");
  const at = nowIso();
  const seed = Math.floor(Math.random() * 2 ** 31);
  await c.env.DB.prepare(
    `INSERT INTO play_sessions (id, opponent, seed, hand_number, hero_actions, total_hands, total_net, created_at, updated_at)
     VALUES (?, ?, ?, 1, '[]', 0, 0, ?, ?)`,
  ).bind(id, opponent, seed, at, at).run();
  const row = await c.env.DB.prepare("SELECT * FROM play_sessions WHERE id = ?").bind(id).first<PlayRow>();
  const { session } = await buildSession(row!, currentSeason());
  return c.json(session);
});

async function loadPlay(env: Env, id: string): Promise<PlayRow | Response> {
  const row = await env.DB.prepare("SELECT * FROM play_sessions WHERE id = ?").bind(id).first<PlayRow>();
  if (!row) return fail(404, "not_found", "セッションが見つかりません");
  return row;
}

app.get("/api/play/:id", async (c) => {
  const row = await loadPlay(c.env, c.req.param("id"));
  if (row instanceof Response) return row;
  const { session } = await buildSession(row, currentSeason());
  return c.json(session);
});

app.post("/api/play/:id/act", async (c) => {
  const row = await loadPlay(c.env, c.req.param("id"));
  if (row instanceof Response) return row;
  const season = currentSeason();
  const current = await buildSession(row, season);
  if (!current.pending) return fail(409, "conflict", "いまはアクションの手番ではありません");

  const body = await c.req.json<{ action?: string; amount?: number }>()
    .catch(() => ({}) as { action?: string; amount?: number });
  const check = validateAction({ action: body.action ?? "", amount: body.amount }, current.pending);
  if (!check.ok) return fail(400, "invalid_request", check.reason);

  const actions = [...(JSON.parse(row.hero_actions) as ActResponse[]), check.value];
  await c.env.DB.prepare("UPDATE play_sessions SET hero_actions = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(actions), nowIso(), row.id).run();
  const { session } = await buildSession({ ...row, hero_actions: JSON.stringify(actions) }, season);
  return c.json(session);
});

app.post("/api/play/:id/next", async (c) => {
  const row = await loadPlay(c.env, c.req.param("id"));
  if (row instanceof Response) return row;
  const season = currentSeason();
  const current = await buildSession(row, season);
  if (!current.finished) return fail(409, "conflict", "まだハンドが終わっていません");
  const net = current.session.lastHand?.heroNet ?? 0;
  const at = nowIso();
  await c.env.DB.prepare(
    `UPDATE play_sessions SET hand_number = hand_number + 1, hero_actions = '[]',
       total_hands = total_hands + 1, total_net = total_net + ?, updated_at = ? WHERE id = ?`,
  ).bind(net, at, row.id).run();
  const updated = await c.env.DB.prepare("SELECT * FROM play_sessions WHERE id = ?").bind(row.id).first<PlayRow>();
  const { session } = await buildSession(updated!, season);
  return c.json(session);
});

// ---------- フォールバック ----------

app.all("/api/*", () => fail(404, "not_found", "そのエンドポイントはありません"));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await ensureBuiltins(env);
        await runLeagueBatch(env, currentSeason(), 20000);
      })(),
    );
  },
};
