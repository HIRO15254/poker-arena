import {
  CHIPS_PER_BB,
  type ActRequest,
  type ActResponse,
  type ActionRecord,
  type LegalAction,
  type PlayHandResult,
  type PlaySeatView,
  type PlaySession,
  type SeasonConfig,
  type Street,
} from "@poker-arena/protocol";
import { categoryOf, playHand, type Agent, type HandConfig, type HandResult } from "@poker-arena/engine";
import { builtinAgent } from "./agents.js";
import type { PlayRow } from "./store.js";
import { mixSeed } from "./util.js";

export const HERO_SEAT = 0;
const VILLAIN_SEAT = 1;

type HandOutcome =
  | { kind: "need"; req: ActRequest }
  | { kind: "done"; result: HandResult };

/** ヘッズアップではボタン = SB。ハンドごとに交代する */
export function buttonForHand(handNumber: number): number {
  return (handNumber - 1) % 2;
}

function positionLabel(seat: number, button: number): string {
  return seat === button ? "btn" : "bb";
}

function streetFromBoard(board: string[]): Street {
  if (board.length >= 5) return "river";
  if (board.length === 4) return "turn";
  if (board.length === 3) return "flop";
  return "preflop";
}

/**
 * 1ハンドを hero のアクション列で再生する。
 * 記録済みアクションを使い切った時点で hero の手番なら、その ActRequest を返して中断する。
 * セッションを (シード, アクション列) から決定的に復元できるので、状態を持たずに済む。
 */
async function runHand(
  season: SeasonConfig,
  seed: number,
  handNumber: number,
  opponent: string,
  heroActions: ActResponse[],
): Promise<HandOutcome> {
  const handSeed = mixSeed(seed, handNumber);
  let cursor = 0;
  let signalNeed!: (req: ActRequest) => void;
  const needPromise = new Promise<ActRequest>((resolve) => {
    signalNeed = resolve;
  });

  const heroAgent: Agent = (req) => {
    const recorded = heroActions[cursor];
    if (recorded !== undefined) {
      cursor++;
      return recorded;
    }
    signalNeed(req);
    // 応答しない Promise を返してエンジンを中断させる(この呼び出しは破棄される)
    return new Promise<never>(() => {});
  };

  const config: HandConfig = {
    handId: `play_${seed}_${handNumber}`,
    seats: [
      { id: "you", stack: season.startingStackBb * CHIPS_PER_BB },
      { id: opponent, stack: season.startingStackBb * CHIPS_PER_BB },
    ],
    button: buttonForHand(handNumber),
    smallBlind: season.smallBlind,
    bigBlind: season.bigBlind,
    rake: season.rake,
    seed: handSeed,
  };

  const agents: Agent[] = [heroAgent, builtinAgent(opponent, handSeed)];
  const finished = playHand(config, agents).then(
    (result) => ({ kind: "done" as const, result }),
  );
  const needed = needPromise.then((req) => ({ kind: "need" as const, req }));
  return Promise.race([finished, needed]);
}

function seatsFromRequest(req: ActRequest, button: number, opponentName: string): PlaySeatView[] {
  return req.players.map((p) => ({
    seat: p.seat,
    name: p.seat === HERO_SEAT ? "you" : opponentName,
    isHero: p.seat === HERO_SEAT,
    stack: p.stack,
    bet: p.bet,
    status: p.status,
    cards: p.seat === HERO_SEAT ? req.hole_cards : null,
    isButton: p.seat === button,
    position: positionLabel(p.seat, button),
  }));
}

function seatsFromResult(
  result: HandResult,
  button: number,
  opponentName: string,
  startingStack: number,
  revealed: Set<number>,
): PlaySeatView[] {
  return result.seats.map((s) => ({
    seat: s.seat,
    name: s.seat === HERO_SEAT ? "you" : opponentName,
    isHero: s.seat === HERO_SEAT,
    stack: startingStack - s.committed + s.won,
    bet: 0,
    status: s.folded ? ("folded" as const) : ("active" as const),
    cards: s.seat === HERO_SEAT || revealed.has(s.seat) ? s.holeCards : null,
    isButton: s.seat === button,
    position: positionLabel(s.seat, button),
  }));
}

function resultToHandResult(result: HandResult, handNumber: number): PlayHandResult {
  const reveals = result.events
    .filter((e): e is Extract<typeof e, { type: "showdown" }> => e.type === "showdown")
    .map((e) => ({ seat: e.seat, cards: e.cards, category: categoryOf(e.score) }));
  const winners = [
    ...new Set(
      result.events
        .filter((e): e is Extract<typeof e, { type: "win" }> => e.type === "win")
        .map((e) => e.seat),
    ),
  ];
  return {
    handId: result.handId,
    board: result.board,
    pot: result.totalPot,
    rake: result.rake,
    heroNet: result.seats[HERO_SEAT]?.net ?? 0,
    winners,
    reveals,
    foldedOut: reveals.length === 0,
  };
}

function actionsOf(result: HandResult): ActionRecord[] {
  return result.events
    .filter((e): e is Extract<typeof e, { type: "action" }> => e.type === "action")
    .map((e) => e.record);
}

export interface SessionView {
  session: PlaySession;
  /** 現在 hero の応答待ちであれば、その合法手 */
  pending: LegalAction[] | null;
  /** ハンドが終了していれば結果 */
  finished: HandResult | null;
}

export async function buildSession(row: PlayRow, season: SeasonConfig): Promise<SessionView> {
  const heroActions = JSON.parse(row.hero_actions) as ActResponse[];
  const button = buttonForHand(row.hand_number);
  const startingStack = season.startingStackBb * CHIPS_PER_BB;
  const label = row.opponent_name ?? row.opponent;
  const outcome = await runHand(season, row.seed, row.hand_number, row.opponent, heroActions);

  const base = {
    id: row.id,
    opponentName: label,
    handNumber: row.hand_number,
    button,
    heroSeat: HERO_SEAT,
    smallBlind: season.smallBlind,
    bigBlind: season.bigBlind,
  };

  if (outcome.kind === "need") {
    const req = outcome.req;
    const totals = totalsOf(row.total_hands, row.total_net);
    const session: PlaySession = {
      ...base,
      handId: req.hand_id,
      street: req.street,
      board: req.board,
      pot: req.pot,
      seats: seatsFromRequest(req, button, label),
      actions: req.actions,
      legalActions: req.legal_actions,
      toAct: HERO_SEAT,
      phase: "acting",
      lastHand: null,
      totals,
    };
    return { session, pending: req.legal_actions, finished: null };
  }

  const result = outcome.result;
  const last = resultToHandResult(result, row.hand_number);
  const revealed = new Set(last.reveals.map((r) => r.seat));
  const totals = totalsOf(row.total_hands + 1, row.total_net + last.heroNet);
  const session: PlaySession = {
    ...base,
    handId: result.handId,
    street: streetFromBoard(result.board),
    board: result.board,
    pot: result.totalPot,
    seats: seatsFromResult(result, button, label, startingStack, revealed),
    actions: actionsOf(result),
    legalActions: [],
    toAct: null,
    phase: "hand_over",
    lastHand: last,
    totals,
  };
  return { session, pending: null, finished: result };
}

function totalsOf(hands: number, netChips: number): PlaySession["totals"] {
  return {
    hands,
    heroNet: netChips,
    bb100: hands > 0 ? (netChips / CHIPS_PER_BB / hands) * 100 : 0,
  };
}

/** クライアントのアクションが合法かを検証する(不正なら理由を返す) */
export function validateAction(
  action: { action: string; amount?: number },
  legal: LegalAction[],
): { ok: true; value: ActResponse } | { ok: false; reason: string } {
  const kind = action.action;
  if (kind === "fold" || kind === "check" || kind === "call") {
    if (!legal.some((l) => l.action === kind)) return { ok: false, reason: `${kind} は選べません` };
    return { ok: true, value: { action: kind } };
  }
  if (kind === "raise") {
    const rule = legal.find((l) => l.action === "raise");
    if (!rule || rule.action !== "raise") return { ok: false, reason: "raise は選べません" };
    const amount = action.amount;
    if (typeof amount !== "number" || !Number.isInteger(amount)) {
      return { ok: false, reason: "raise には整数の amount が必要です" };
    }
    if (amount < rule.min || amount > rule.max) {
      return { ok: false, reason: `raise は ${rule.min} 〜 ${rule.max} の範囲で指定してください` };
    }
    return { ok: true, value: { action: "raise", amount } };
  }
  return { ok: false, reason: `未知のアクション: ${kind}` };
}
