import type { D1Database } from "@cloudflare/workers-types";

export interface UserRow {
  id: string;
  name: string;
  api_key_hash: string;
  created_at: string;
}

export interface BotRow {
  id: string;
  owner_id: string;
  name: string;
  kind: string;
  webhook_url: string | null;
  builtin_strategy: string | null;
  secret: string;
  status: string;
  version: number;
  last_error: string | null;
  last_error_at: string | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

export interface StatsRow {
  season_id: string;
  bot_id: string;
  version: number;
  hands: number;
  net_chips: number;
  sum_sq_bb: number;
  vpip_hands: number;
  pfr_hands: number;
  showdown_hands: number;
  won_showdown: number;
  btn_hands: number;
  btn_net: number;
  bb_hands: number;
  bb_net: number;
  updated_at: string;
}

export interface HandRow {
  id: string;
  season_id: string;
  table_id: string;
  hand_number: number;
  played_at: string;
  button: number;
  small_blind: number;
  big_blind: number;
  board: string;
  pot: number;
  rake: number;
  seats: string;
  actions: string;
}

export interface PlayRow {
  id: string;
  opponent: string;
  seed: number;
  hand_number: number;
  hero_actions: string;
  total_hands: number;
  total_net: number;
  created_at: string;
  updated_at: string;
}

export interface StoredSeat {
  seat: number;
  botId: string;
  botName: string;
  ownerName: string;
  startingStack: number;
  holeCards: string[];
  net: number;
  showedDown: boolean;
}

export async function getUserByApiKeyHash(db: D1Database, hash: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE api_key_hash = ?").bind(hash).first<UserRow>();
}

export async function getBot(db: D1Database, id: string): Promise<BotRow | null> {
  return db.prepare("SELECT * FROM bots WHERE id = ?").bind(id).first<BotRow>();
}

export async function listBotsByOwner(db: D1Database, ownerId: string): Promise<BotRow[]> {
  const res = await db
    .prepare("SELECT * FROM bots WHERE owner_id = ? ORDER BY created_at")
    .bind(ownerId)
    .all<BotRow>();
  return res.results ?? [];
}

export async function listActiveBots(db: D1Database): Promise<BotRow[]> {
  const res = await db
    .prepare("SELECT * FROM bots WHERE status = 'active' ORDER BY created_at")
    .all<BotRow>();
  return res.results ?? [];
}

export async function getStats(
  db: D1Database,
  seasonId: string,
  botId: string,
  version: number,
): Promise<StatsRow | null> {
  return db
    .prepare("SELECT * FROM season_stats WHERE season_id = ? AND bot_id = ? AND version = ?")
    .bind(seasonId, botId, version)
    .first<StatsRow>();
}
