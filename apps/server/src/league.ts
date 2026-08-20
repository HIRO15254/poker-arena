import { CHIPS_PER_BB, type SeasonConfig } from "@poker-arena/protocol";
import {
  playHand,
  type Agent,
  type HandConfig,
  type HandResult,
} from "@poker-arena/engine";
import type { Env } from "./env.js";
import { builtinAgent, webhookAgent, type WebhookOutcome } from "./agents.js";
import { listActiveBots, type BotRow, type StoredSeat } from "./store.js";
import { newId, newSecret, nowIso } from "./util.js";
import { secureDeck, secureSeed } from "./shuffle.js";

const WEBHOOK_TIMEOUT_MS = 5000;
/** 連続失敗がこの回数に達した bot は自動離席する(SPEC §5) */
const AUTO_ERROR_THRESHOLD = 20;
/** 保存するハンド履歴の上限。超過分は古い順に削除 */
const HAND_RETENTION = 20000;
/** bb/100 推移の保持点数(bot・バージョンごと)。API が返す上限と揃える */
const TIMELINE_RETENTION = 200;

interface StatDelta {
  hands: number;
  net: number;
  sumSqBb: number;
  vpip: number;
  pfr: number;
  showdown: number;
  wonShowdown: number;
  btnHands: number;
  btnNet: number;
  bbHands: number;
  bbNet: number;
}

function emptyDelta(): StatDelta {
  return {
    hands: 0,
    net: 0,
    sumSqBb: 0,
    vpip: 0,
    pfr: 0,
    showdown: 0,
    wonShowdown: 0,
    btnHands: 0,
    btnNet: 0,
    bbHands: 0,
    bbNet: 0,
  };
}

/** システム所有の組み込み bot を用意する(初回のみ) */
export async function ensureBuiltins(env: Env): Promise<void> {
  const existing = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM bots WHERE kind = 'builtin'",
  ).first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) return;

  const at = nowIso();
  const systemId = "usr_system";
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, name, api_key_hash, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(systemId, "arena", `system-${systemId}`, at)
    .run();

  const presets: { name: string; strategy: string }[] = [
    { name: "house-tight", strategy: "tight" },
    { name: "house-balanced", strategy: "balanced" },
    { name: "house-lag", strategy: "lag" },
    { name: "house-aggro", strategy: "aggro" },
    { name: "house-call", strategy: "call" },
    { name: "house-random", strategy: "random" },
    { name: "house-rock", strategy: "fold" },
  ];
  const stmts = presets.map((p) =>
    env.DB.prepare(
      `INSERT INTO bots (id, owner_id, name, kind, builtin_strategy, secret, status, version, created_at, updated_at)
       VALUES (?, ?, ?, 'builtin', ?, ?, 'active', 1, ?, ?)`,
    ).bind(newId("bot"), systemId, p.name, p.strategy, newSecret(), at, at),
  );
  await env.DB.batch(stmts);
}

function agentFor(bot: BotRow, seed: number, outcome: WebhookOutcome): Agent {
  if (bot.kind === "webhook" && bot.webhook_url) {
    return webhookAgent(
      bot.webhook_url,
      bot.secret,
      WEBHOOK_TIMEOUT_MS,
      outcome,
    );
  }
  return builtinAgent(bot.builtin_strategy ?? "call", seed);
}

/** ハンド結果から1 bot 分の統計を積む */
function accumulate(
  delta: StatDelta,
  result: HandResult,
  seat: number,
  isButton: boolean,
): void {
  const seatResult = result.seats[seat];
  if (!seatResult) return;
  const net = seatResult.net;
  const netBb = net / CHIPS_PER_BB;
  delta.hands++;
  delta.net += net;
  delta.sumSqBb += netBb * netBb;
  if (isButton) {
    delta.btnHands++;
    delta.btnNet += net;
  } else {
    delta.bbHands++;
    delta.bbNet += net;
  }
  const preflop = result.events.filter(
    (e) =>
      e.type === "action" &&
      e.record.seat === seat &&
      e.record.street === "preflop",
  );
  const voluntary = preflop.some(
    (e) =>
      e.type === "action" && ["call", "bet", "raise"].includes(e.record.action),
  );
  const raised = preflop.some(
    (e) => e.type === "action" && e.record.action === "raise",
  );
  if (voluntary) delta.vpip++;
  if (raised) delta.pfr++;
  if (seatResult.showedDown) {
    delta.showdown++;
    if (net > 0) delta.wonShowdown++;
  }
}

function pairKey(a: string, b: string): string {
  return a < b ? `tbl_${a}_${b}` : `tbl_${b}_${a}`;
}

export interface BatchReport {
  handsPlayed: number;
  pairsPlayed: number;
  elapsedMs: number;
  deactivated: string[];
  /** バッチ途中で捕捉した想定外のエラー */
  error?: string;
}

/**
 * アクティブな bot 同士を総当たりで対戦させる。
 * 予算(budgetMs)を超えたら打ち切り、次の tick で続きから回す。
 */
export async function runLeagueBatch(
  env: Env,
  season: SeasonConfig,
  budgetMs: number,
): Promise<BatchReport> {
  const started = Date.now();
  const bots = await listActiveBots(env.DB);
  const report: BatchReport = {
    handsPlayed: 0,
    pairsPlayed: 0,
    elapsedMs: 0,
    deactivated: [],
  };
  if (bots.length < 2) {
    report.elapsedMs = Date.now() - started;
    return report;
  }

  const deltas = new Map<string, StatDelta>();
  const handRows: {
    id: string;
    tableId: string;
    handNumber: number;
    button: number;
    result: HandResult;
    seats: StoredSeat[];
  }[] = [];
  const tableUpdates = new Map<
    string,
    { botA: string; botB: string; handNumber: number; lastHandId: string }
  >();
  const failures = new Map<string, WebhookOutcome>();

  // 総当たりのペアを作り、tick ごとに開始位置をずらして偏りを防ぐ
  const pairs: [BotRow, BotRow][] = [];
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const a = bots[i]!;
      const b = bots[j]!;
      if (a.owner_id === b.owner_id && a.owner_id !== "usr_system") continue; // 同一ユーザーは同卓しない
      pairs.push([a, b]);
    }
  }
  const offset = Math.floor(Date.now() / 60000) % Math.max(1, pairs.length);
  const ordered = [...pairs.slice(offset), ...pairs.slice(0, offset)];

  // ループ全体を保護する。1ペアの想定外の例外でバッチ全体が persist に到達しないと、
  // その tick で積み上げた全ユーザーのハンドと統計が失われ、cron が毎分同じ失敗を繰り返す。
  try {
    for (const [a, b] of ordered) {
      if (Date.now() - started > budgetMs) break;
      const hasWebhook = a.kind === "webhook" || b.kind === "webhook";
      const handsThisPair = hasWebhook ? 12 : 120;
      const tableId = pairKey(a.id, b.id);
      const existing = await env.DB.prepare(
        "SELECT hand_number FROM tables WHERE id = ?",
      )
        .bind(tableId)
        .first<{ hand_number: number }>();
      let handNumber = existing?.hand_number ?? 0;

      const outcomeA: WebhookOutcome = failures.get(a.id) ?? {
        failures: a.consecutive_failures,
        lastError: null,
      };
      const outcomeB: WebhookOutcome = failures.get(b.id) ?? {
        failures: b.consecutive_failures,
        lastError: null,
      };
      failures.set(a.id, outcomeA);
      failures.set(b.id, outcomeB);

      for (let h = 0; h < handsThisPair; h++) {
        if (Date.now() - started > budgetMs) break;
        handNumber++;
        const button = handNumber % 2; // 0 → a がボタン(=SB)
        const seed = secureSeed(); // bot の内部乱数用。デッキとは無関係
        const handId = newId("h");
        const config: HandConfig = {
          handId,
          seats: [
            { id: a.id, stack: season.startingStackBb * CHIPS_PER_BB },
            { id: b.id, stack: season.startingStackBb * CHIPS_PER_BB },
          ],
          button,
          smallBlind: season.smallBlind,
          bigBlind: season.bigBlind,
          rake: season.rake,
          deck: secureDeck(),
        };
        // エージェント構築も失敗しうる(不正な戦略名が保存されている等)。
        // ここで throw させるとバッチ全体が persist に到達せず、リーグが止まる。
        let result: HandResult;
        try {
          const agents = [
            agentFor(a, seed, outcomeA),
            agentFor(b, seed + 1, outcomeB),
          ];
          result = await playHand(config, agents);
        } catch {
          break; // このペアは諦めて次へ
        }
        report.handsPlayed++;

        for (const [idx, bot] of [a, b].entries()) {
          const delta = deltas.get(bot.id) ?? emptyDelta();
          accumulate(delta, result, idx, button === idx);
          deltas.set(bot.id, delta);
        }

        // 履歴保存: webhook bot が絡むハンドは全件、組み込み同士は間引く
        const keep = hasWebhook || handNumber % 10 === 0;
        if (keep) {
          const seats: StoredSeat[] = [a, b].map((bot, idx) => ({
            seat: idx,
            botId: bot.id,
            botName: bot.name,
            ownerName: bot.owner_id === "usr_system" ? "arena" : bot.owner_id,
            startingStack: season.startingStackBb * CHIPS_PER_BB,
            holeCards: result.seats[idx]?.holeCards ?? [],
            net: result.seats[idx]?.net ?? 0,
            showedDown: result.seats[idx]?.showedDown ?? false,
          }));
          handRows.push({
            id: handId,
            tableId,
            handNumber,
            button,
            result,
            seats,
          });
        }
        tableUpdates.set(tableId, {
          botA: a.id,
          botB: b.id,
          handNumber,
          lastHandId: handId,
        });
      }
      report.pairsPlayed++;
    }
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
  }

  await persist(env, season, deltas, handRows, tableUpdates, failures, report);
  report.elapsedMs = Date.now() - started;
  return report;
}

async function persist(
  env: Env,
  season: SeasonConfig,
  deltas: Map<string, StatDelta>,
  handRows: {
    id: string;
    tableId: string;
    handNumber: number;
    button: number;
    result: HandResult;
    seats: StoredSeat[];
  }[],
  tableUpdates: Map<
    string,
    { botA: string; botB: string; handNumber: number; lastHandId: string }
  >,
  failures: Map<string, WebhookOutcome>,
  report: BatchReport,
): Promise<void> {
  const at = nowIso();
  const stmts: D1PreparedStatement[] = [];

  for (const [botId, d] of deltas) {
    const bot = await env.DB.prepare("SELECT version FROM bots WHERE id = ?")
      .bind(botId)
      .first<{ version: number }>();
    const version = bot?.version ?? 1;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO season_stats (season_id, bot_id, version, hands, net_chips, sum_sq_bb,
            vpip_hands, pfr_hands, showdown_hands, won_showdown, btn_hands, btn_net, bb_hands, bb_net, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(season_id, bot_id, version) DO UPDATE SET
            hands = hands + excluded.hands,
            net_chips = net_chips + excluded.net_chips,
            sum_sq_bb = sum_sq_bb + excluded.sum_sq_bb,
            vpip_hands = vpip_hands + excluded.vpip_hands,
            pfr_hands = pfr_hands + excluded.pfr_hands,
            showdown_hands = showdown_hands + excluded.showdown_hands,
            won_showdown = won_showdown + excluded.won_showdown,
            btn_hands = btn_hands + excluded.btn_hands,
            btn_net = btn_net + excluded.btn_net,
            bb_hands = bb_hands + excluded.bb_hands,
            bb_net = bb_net + excluded.bb_net,
            updated_at = excluded.updated_at`,
      ).bind(
        season.id,
        botId,
        version,
        d.hands,
        d.net,
        d.sumSqBb,
        d.vpip,
        d.pfr,
        d.showdown,
        d.wonShowdown,
        d.btnHands,
        d.btnNet,
        d.bbHands,
        d.bbNet,
        at,
      ),
    );
  }

  for (const row of handRows) {
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO hands
          (id, season_id, table_id, hand_number, played_at, button, small_blind, big_blind, board, pot, rake, seats, actions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        row.id,
        season.id,
        row.tableId,
        row.handNumber,
        at,
        row.button,
        season.smallBlind,
        season.bigBlind,
        JSON.stringify(row.result.board),
        row.result.totalPot,
        row.result.rake,
        JSON.stringify(row.seats),
        JSON.stringify(
          row.result.events
            .filter((e) => e.type === "action")
            .map((e) => (e as { record: unknown }).record),
        ),
      ),
    );
    for (const seat of row.seats) {
      stmts.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO hand_seats (hand_id, bot_id, seat, net, showdown, played_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(
          row.id,
          seat.botId,
          seat.seat,
          seat.net,
          seat.showedDown ? 1 : 0,
          at,
        ),
      );
    }
  }

  for (const [tableId, t] of tableUpdates) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO tables (id, season_id, bot_a, bot_b, hand_number, last_hand_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           hand_number = excluded.hand_number,
           last_hand_id = excluded.last_hand_id,
           updated_at = excluded.updated_at`,
      ).bind(
        tableId,
        season.id,
        t.botA,
        t.botB,
        t.handNumber,
        t.lastHandId,
        at,
      ),
    );
  }

  for (const [botId, outcome] of failures) {
    if (outcome.failures >= AUTO_ERROR_THRESHOLD) {
      report.deactivated.push(botId);
      stmts.push(
        env.DB.prepare(
          `UPDATE bots SET status = 'error', consecutive_failures = ?, last_error = ?, last_error_at = ?, updated_at = ?
           WHERE id = ? AND kind = 'webhook'`,
        ).bind(
          outcome.failures,
          outcome.lastError ?? "連続タイムアウト",
          at,
          at,
          botId,
        ),
      );
    } else {
      stmts.push(
        env.DB.prepare(
          `UPDATE bots SET consecutive_failures = ?, last_error = COALESCE(?, last_error), updated_at = ? WHERE id = ?`,
        ).bind(outcome.failures, outcome.lastError, at, botId),
      );
    }
  }

  // bb/100 推移のスナップショット
  for (const botId of deltas.keys()) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO stat_timeline (season_id, bot_id, version, hands, bb100, at)
         SELECT season_id, bot_id, version, hands,
                CASE WHEN hands > 0 THEN (net_chips * 1.0 / ? / hands) * 100 ELSE 0 END, ?
         FROM season_stats WHERE season_id = ? AND bot_id = ?`,
      ).bind(CHIPS_PER_BB, at, season.id, botId),
    );
  }

  // D1 のバッチ上限に配慮して分割実行
  for (let i = 0; i < stmts.length; i += 50) {
    await env.DB.batch(stmts.slice(i, i + 50));
  }

  // 保持上限を超えた古いデータを間引く。
  // cron は毎分回るので、放置すると hand_seats と stat_timeline が無限に増える。
  await env.DB.batch([
    // 1) 古いハンド本体
    env.DB.prepare(
      `DELETE FROM hands WHERE id IN (
         SELECT id FROM hands ORDER BY played_at DESC LIMIT -1 OFFSET ?
       )`,
    ).bind(HAND_RETENTION),
    // 2) 本体を失った hand_seats の孤児
    env.DB.prepare(
      "DELETE FROM hand_seats WHERE hand_id NOT IN (SELECT id FROM hands)",
    ),
    // 3) bb/100 推移は bot ごとに直近 TIMELINE_RETENTION 点だけ残す
    env.DB.prepare(
      `DELETE FROM stat_timeline WHERE rowid IN (
         SELECT rowid FROM (
           SELECT rowid,
                  ROW_NUMBER() OVER (PARTITION BY season_id, bot_id, version ORDER BY hands DESC) AS rn
           FROM stat_timeline
         ) WHERE rn > ?
       )`,
    ).bind(TIMELINE_RETENTION),
  ]);
}
