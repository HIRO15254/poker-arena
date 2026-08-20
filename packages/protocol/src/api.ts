/**
 * Poker Arena REST API の型契約。
 * サーバー(apps/server)とフロントエンド(apps/web)が共有する。
 * 認証: `Authorization: Bearer <apiKey>`(読み取り専用エンドポイントは匿名可)。
 * 金額は全てチップ絶対値。UI 表示のみ bb 換算する。
 */

import type { ActionRecord, LegalAction, Street } from "./index.js";
import type { GameFormat, SeasonConfig } from "./season.js";

export type BotKind = "webhook" | "builtin";

export type BotStatus =
  | "idle" // 登録済み・未稼働
  | "active" // 稼働中(着席対象)
  | "error"; // 連続タイムアウト等で自動離席

export interface BotSummary {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  kind: BotKind;
  status: BotStatus;
  version: number;
  /** 現行バージョン・現シーズンの成績 */
  hands: number;
  netChips: number;
  bb100: number;
  /** 95% 信頼区間の半幅(bb/100)。ハンド数が少ないと null */
  ci95: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BotDetail extends BotSummary {
  /** 自分の bot のみ返る */
  webhookUrl?: string;
  builtinStrategy?: string;
  lastError?: { message: string; at: string } | null;
  versions: BotVersionRecord[];
  stats?: BotStats;
}

export interface BotVersionRecord {
  version: number;
  deployedAt: string;
  hands: number;
  netChips: number;
  bb100: number;
  note?: string;
}

export interface BotStats {
  hands: number;
  bb100: number;
  vpip: number;
  pfr: number;
  wtsd: number;
  wonAtShowdown: number;
  /** ポジション別 bb/100。HU は "btn"(=SB) と "bb" */
  byPosition: Record<string, { hands: number; bb100: number }>;
  /** 直近の推移(累計 bb/100)。等間隔サンプル */
  timeline: { hands: number; bb100: number }[];
}

export interface LeaderboardEntry extends BotSummary {
  rank: number;
  /** 掲載条件(最低ハンド数)を満たしているか */
  qualified: boolean;
}

export interface LeaderboardResponse {
  season: SeasonConfig;
  entries: LeaderboardEntry[];
  totalBots: number;
  updatedAt: string;
}

// ---------- テーブル(観戦) ----------

export interface TableSeatView {
  seat: number;
  botId: string;
  botName: string;
  ownerName: string;
  stack: number;
  bet: number;
  status: "active" | "folded" | "allin" | "empty";
  /** ショーダウンで公開された場合のみ */
  cards?: string[];
  isButton: boolean;
  /** アクション待ちの席 */
  toAct: boolean;
}

export interface TableView {
  id: string;
  format: GameFormat;
  handId: string;
  handNumber: number;
  street: Street;
  board: string[];
  pot: number;
  seats: TableSeatView[];
  actions: ActionRecord[];
  spectators: number;
  updatedAt: string;
}

export interface TableSummary {
  id: string;
  format: GameFormat;
  street: Street;
  handNumber: number;
  seatedBots: string[];
  occupancy: string; // "2/2"
}

/** WebSocket /api/tables/:id/watch が配信するイベント */
export type TableWatchEvent =
  | { type: "snapshot"; table: TableView }
  | { type: "hand_start"; handId: string; handNumber: number; button: number }
  | { type: "action"; record: ActionRecord; pot: number; seats: TableSeatView[] }
  | { type: "deal"; street: Street; cards: string[]; board: string[] }
  | { type: "showdown"; reveals: { seat: number; cards: string[]; category: string }[] }
  | { type: "hand_end"; results: { seat: number; net: number; won: number }[]; rake: number };

// ---------- ハンド履歴 ----------

export interface HandSummary {
  handId: string;
  tableId: string;
  playedAt: string;
  /** 自 bot の席 */
  seat: number;
  position: string;
  holeCards: string[];
  board: string[];
  net: number;
  potSize: number;
  wentToShowdown: boolean;
  opponents: { seat: number; botName: string }[];
}

export interface HandDetail extends HandSummary {
  /** 自分視点。相手のカードはショーダウン公開分のみ */
  seats: {
    seat: number;
    botName: string;
    startingStack: number;
    holeCards: string[] | null;
    net: number;
  }[];
  actions: ActionRecord[];
  streets: { street: Street; board: string[] }[];
  rake: number;
  smallBlind: number;
  bigBlind: number;
  button: number;
}

// ---------- リクエスト ----------

export interface CreateBotRequest {
  name: string;
  kind: BotKind;
  /** kind=webhook の場合必須 */
  webhookUrl?: string;
  /** kind=builtin の場合必須 (fold|call|random|aggro|tight) */
  builtinStrategy?: string;
}

export interface DeployVersionRequest {
  webhookUrl?: string;
  builtinStrategy?: string;
  note?: string;
}

export interface TestMatchRequest {
  botId: string;
  /** 対戦相手。builtin 名 or 自分の botId */
  opponent: string;
  hands: number;
  seed?: number;
}

export interface TestMatchResponse {
  hands: number;
  results: { id: string; netChips: number; bb100: number }[];
  /** 直近ハンドの id(リプレイ用) */
  sampleHandIds: string[];
  durationMs: number;
}

export interface ApiError {
  error: string;
  message: string;
}

// ---------- 人間 vs bot のプレイ(ブラウザ) ----------

export type PlayPhase = "acting" | "hand_over";

export interface PlaySeatView {
  seat: number;
  name: string;
  isHero: boolean;
  stack: number;
  bet: number;
  status: "active" | "folded" | "allin";
  /** hero は常に見える。相手はショーダウン公開時のみ */
  cards: string[] | null;
  isButton: boolean;
  position: string;
}

export interface PlayHandResult {
  handId: string;
  board: string[];
  pot: number;
  rake: number;
  heroNet: number;
  winners: number[];
  reveals: { seat: number; cards: string[]; category: string }[];
  /** ショーダウンに至らずフォールド決着した場合 true */
  foldedOut: boolean;
}

export interface PlaySession {
  id: string;
  opponentName: string;
  handNumber: number;
  handId: string;
  street: Street;
  board: string[];
  pot: number;
  button: number;
  heroSeat: number;
  seats: PlaySeatView[];
  actions: ActionRecord[];
  /** hero の手番でなければ空配列 */
  legalActions: LegalAction[];
  toAct: number | null;
  phase: PlayPhase;
  lastHand: PlayHandResult | null;
  smallBlind: number;
  bigBlind: number;
  /** このセッションの通算成績 */
  totals: { hands: number; heroNet: number; bb100: number };
}

export interface CreatePlayRequest {
  /** 対戦相手: builtin 名(fold|call|random|aggro|tight)または botId */
  opponent: string;
}

export interface PlayActRequest {
  action: "fold" | "check" | "call" | "raise";
  /** raise の場合の raise to 額(チップ) */
  amount?: number;
}
