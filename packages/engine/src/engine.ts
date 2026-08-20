import type {
  ActRequest,
  ActResponse,
  ActionRecord,
  LegalAction,
  PlayerState,
  Street,
} from "@poker-arena/protocol";
import { Card, cardToString, freshDeck } from "./cards.js";
import { evaluate7 } from "./evaluator.js";
import { mulberry32, shuffleInPlace } from "./rng.js";

export interface SeatInit {
  id: string;
  stack: number;
}

export interface RakeConfig {
  /** ポットに対する % (例: 5) */
  percent: number;
  /** キャップ(チップ)。4bb = 400 */
  capChips: number;
  /** フロップが開いていないハンドはレーキなし */
  noFlopNoDrop: boolean;
}

export interface HandConfig {
  handId?: string;
  seats: SeatInit[];
  /** ボタンの席インデックス */
  button: number;
  smallBlind: number;
  bigBlind: number;
  rake: RakeConfig;
  /** テスト用: デッキを直接指定(先頭から配られる)。省略時は seed でシャッフル */
  deck?: Card[];
  seed?: number;
}

/** bot 実装(サンドボックス/Webhook/内蔵bot 共通のインターフェース) */
export type Agent = (req: ActRequest) => ActResponse | Promise<ActResponse>;

export type HandEvent =
  | { type: "blind"; seat: number; kind: "sb" | "bb"; amount: number }
  | { type: "deal"; street: Exclude<Street, "preflop">; cards: string[] }
  | { type: "action"; record: ActionRecord }
  | { type: "showdown"; seat: number; cards: string[]; score: number }
  | { type: "win"; seat: number; amount: number; potIndex: number }
  | { type: "rake"; amount: number };

export interface SeatResult {
  seat: number;
  id: string;
  holeCards: string[];
  committed: number;
  won: number;
  /** won - committed */
  net: number;
  folded: boolean;
  showedDown: boolean;
}

export interface HandResult {
  handId: string;
  board: string[];
  totalPot: number;
  rake: number;
  events: HandEvent[];
  seats: SeatResult[];
}

interface Seat {
  idx: number;
  id: string;
  stack: number;
  streetBet: number;
  committed: number;
  folded: boolean;
  allIn: boolean;
  hole: Card[];
  won: number;
  showedDown: boolean;
}

const STREETS: Street[] = ["preflop", "flop", "turn", "river"];

export async function playHand(config: HandConfig, agents: Agent[]): Promise<HandResult> {
  const n = config.seats.length;
  if (n < 2 || n > 9) throw new Error(`seat count must be 2..9, got ${n}`);
  if (agents.length !== n) throw new Error("agents length must match seats length");
  const handId = config.handId ?? `h_${(config.seed ?? 0).toString(36)}`;

  const seats: Seat[] = config.seats.map((s, i) => ({
    idx: i,
    id: s.id,
    stack: s.stack,
    streetBet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    hole: [],
    won: 0,
    showedDown: false,
  }));
  const events: HandEvent[] = [];
  const actionLog: ActionRecord[] = [];
  const board: Card[] = [];

  const deck = config.deck ? [...config.deck] : shuffleInPlace(freshDeck(), mulberry32(config.seed ?? 1));
  let deckPos = 0;
  const draw = (): Card => {
    const c = deck[deckPos++];
    if (c === undefined) throw new Error("deck exhausted");
    return c;
  };

  const seatAfter = (i: number, steps = 1) => (i + steps) % n;
  /** from から時計回りで cond を満たす最初の席 */
  const nextWhere = (from: number, cond: (s: Seat) => boolean): number => {
    for (let k = 0; k < n; k++) {
      const i = seatAfter(from, k + 1);
      if (cond(seats[i]!)) return i;
    }
    return -1;
  };

  const headsUp = n === 2;
  const sbSeat = headsUp ? config.button : seatAfter(config.button);
  const bbSeat = headsUp ? seatAfter(config.button) : seatAfter(config.button, 2);

  const put = (seat: Seat, amount: number) => {
    const real = Math.min(amount, seat.stack);
    seat.stack -= real;
    seat.streetBet += real;
    seat.committed += real;
    if (seat.stack === 0) seat.allIn = true;
    return real;
  };

  // ブラインド
  {
    const sb = seats[sbSeat]!;
    const bb = seats[bbSeat]!;
    const sbAmt = put(sb, config.smallBlind);
    events.push({ type: "blind", seat: sbSeat, kind: "sb", amount: sbAmt });
    actionLog.push({ seat: sbSeat, street: "preflop", action: "post_sb", amount: sbAmt, ...(sb.allIn ? { all_in: true } : {}) });
    const bbAmt = put(bb, config.bigBlind);
    events.push({ type: "blind", seat: bbSeat, kind: "bb", amount: bbAmt });
    actionLog.push({ seat: bbSeat, street: "preflop", action: "post_bb", amount: bbAmt, ...(bb.allIn ? { all_in: true } : {}) });
  }

  // ディール(SB から時計回りに1枚ずつ2周)
  for (let round = 0; round < 2; round++) {
    for (let k = 0; k < n; k++) {
      const i = headsUp ? seatAfter(config.button, k) : seatAfter(config.button, k + 1);
      seats[i]!.hole.push(draw());
    }
  }

  const contenders = () => seats.filter((s) => !s.folded);
  const canAct = () => seats.filter((s) => !s.folded && !s.allIn);
  const totalPot = () => seats.reduce((a, s) => a + s.committed, 0);

  const buildRequest = (seat: Seat, street: Street, legal: LegalAction[]): ActRequest => {
    const players: PlayerState[] = seats.map((s) => ({
      seat: s.idx,
      stack: s.stack,
      bet: s.streetBet,
      status: s.folded ? "folded" : s.allIn ? "allin" : "active",
    }));
    return {
      type: "act",
      hand_id: handId,
      seat: seat.idx,
      hole_cards: seat.hole.map(cardToString),
      board: board.map(cardToString),
      street,
      pot: totalPot(),
      players,
      actions: [...actionLog],
      legal_actions: legal,
    };
  };

  const bettingRound = async (street: Street): Promise<void> => {
    // 実際に出ている最大額。ブラインドがオールインで満額に満たない場合はその額が基準になる
    let currentBet =
      street === "preflop"
        ? Math.max(0, ...seats.filter((s) => !s.folded).map((s) => s.streetBet))
        : 0;
    // 最後のフルレイズ幅。プリフロップは BB、ポストフロップの最小ベットも BB
    let lastFullRaise = config.bigBlind;
    /** 最後のフルレイズ以降にアクション済みの席(ショートオールインではリセットされない) */
    const actedSinceFullRaise = new Set<number>();

    const start = street === "preflop"
      ? (headsUp ? config.button : seatAfter(config.button, 3))
      : nextWhere(config.button, (s) => !s.folded && !s.allIn);
    if (start < 0) return;

    // アクション待ちキュー(順序付き)
    const pending: number[] = [];
    const pushOrderFrom = (from: number, include: (s: Seat) => boolean) => {
      for (let k = 0; k < n; k++) {
        const i = (from + k) % n;
        const s = seats[i]!;
        if (include(s) && !pending.includes(i)) pending.push(i);
      }
    };
    pushOrderFrom(start, (s) => !s.folded && !s.allIn);

    while (pending.length > 0) {
      if (contenders().length <= 1) return;
      const idx = pending.shift()!;
      const seat = seats[idx]!;
      if (seat.folded || seat.allIn) continue;

      // 合法アクションの計算
      const toCall = currentBet - seat.streetBet;
      const legal: LegalAction[] = [];
      if (toCall > 0) legal.push({ action: "fold" });
      if (toCall === 0) legal.push({ action: "check" });
      else legal.push({ action: "call", amount: Math.min(toCall, seat.stack) });
      const maxRaiseTo = seat.streetBet + seat.stack;
      const minRaiseTo = Math.min(currentBet + lastFullRaise, maxRaiseTo);
      const raiseAllowed = maxRaiseTo > currentBet && !(toCall > 0 && actedSinceFullRaise.has(idx));
      if (raiseAllowed) legal.push({ action: "raise", min: minRaiseTo, max: maxRaiseTo });

      // bot に問い合わせ、不正なら check があれば check、なければ fold(SPEC §11)
      let res: ActResponse;
      let forced = false;
      try {
        res = await agents[idx]!(buildRequest(seat, street, legal));
      } catch {
        res = { action: "fold" };
        forced = true;
      }
      const normalized = normalize(res, legal);
      if (normalized === null) {
        forced = true;
        res = toCall === 0 ? { action: "check" } : { action: "fold" };
      } else {
        res = normalized;
      }

      if (res.action === "fold") {
        seat.folded = true;
        record(idx, street, "fold", undefined, seat, forced);
      } else if (res.action === "check") {
        actedSinceFullRaise.add(idx);
        record(idx, street, "check", undefined, seat, forced);
      } else if (res.action === "call") {
        put(seat, toCall);
        actedSinceFullRaise.add(idx);
        record(idx, street, "call", seat.streetBet, seat, forced);
      } else {
        // raise to res.amount(clamp 済み)
        const raiseTo = res.amount;
        const raiseSize = raiseTo - currentBet;
        put(seat, raiseTo - seat.streetBet);
        const isFullRaise = raiseSize >= lastFullRaise;
        if (isFullRaise) {
          lastFullRaise = raiseSize;
          actedSinceFullRaise.clear();
        }
        actedSinceFullRaise.add(idx);
        const kind = currentBet === 0 ? "bet" : "raise";
        currentBet = raiseTo;
        record(idx, street, kind, raiseTo, seat, forced);
        // レイズ後、他の全アクション可能席が再度アクション対象になる
        pending.length = 0;
        pushOrderFrom(seatAfter(idx), (s) => !s.folded && !s.allIn && s.idx !== idx);
      }
    }
  };

  const record = (
    seatIdx: number,
    street: Street,
    action: ActionRecord["action"],
    amount: number | undefined,
    seat: Seat,
    forced: boolean,
  ) => {
    const rec: ActionRecord = {
      seat: seatIdx,
      street,
      action,
      ...(amount !== undefined ? { amount } : {}),
      ...(seat.allIn && action !== "fold" && action !== "check" ? { all_in: true } : {}),
      ...(forced ? { forced: true } : {}),
    };
    actionLog.push(rec);
    events.push({ type: "action", record: rec });
  };

  const normalize = (res: ActResponse, legal: LegalAction[]): ActResponse | null => {
    if (!res || typeof res !== "object") return null;
    if (res.action === "fold") return legal.some((l) => l.action === "fold") ? res : null;
    if (res.action === "check") return legal.some((l) => l.action === "check") ? res : null;
    if (res.action === "call") return legal.some((l) => l.action === "call") ? res : null;
    if (res.action === "raise") {
      const r = legal.find((l) => l.action === "raise");
      if (!r || r.action !== "raise") return null;
      if (!Number.isInteger(res.amount)) return null;
      // 範囲外の raise は min/max に clamp するのではなく不正扱い(SPEC: check-fold 処理)
      if (res.amount < r.min || res.amount > r.max) return null;
      return res;
    }
    return null;
  };

  // ストリート進行(決着済みなら以降のカードは配らない。全員オールインの場合はランアウト)
  for (const street of STREETS) {
    if (contenders().length <= 1) break;
    if (street !== "preflop") {
      const count = street === "flop" ? 3 : 1;
      const cards: Card[] = [];
      for (let i = 0; i < count; i++) cards.push(draw());
      board.push(...cards);
      events.push({ type: "deal", street, cards: cards.map(cardToString) });
    }
    seats.forEach((s) => (s.streetBet = 0));
    if (street === "preflop") {
      // ブラインドは streetBet に含める
      seats[sbSeat]!.streetBet = seats[sbSeat]!.committed;
      seats[bbSeat]!.streetBet = seats[bbSeat]!.committed;
    }
    // アクション可能な席が2つ以上あるか、1つでもその席が未払いを抱えているならラウンドを回す。
    // 後者は「ブラインドをオールインで満額出せなかった相手に対して、
    // もう一方がコール/フォールドを選べないまま showdown に進む」バグを防ぐ。
    const actors = canAct();
    const maxStreetBet = Math.max(0, ...seats.filter((s) => !s.folded).map((s) => s.streetBet));
    const soleActorOwes = actors.length === 1 && actors[0]!.streetBet < maxStreetBet;
    if (actors.length > 1 || soleActorOwes) {
      await bettingRound(street);
    }
  }

  // 決着
  const pot = totalPot();
  const flopDealt = board.length >= 3;
  const rakeTotal =
    config.rake.noFlopNoDrop && !flopDealt
      ? 0
      : Math.min(Math.floor((pot * config.rake.percent) / 100), config.rake.capChips);

  const alive = contenders();
  if (alive.length === 1) {
    const winner = alive[0]!;
    const amount = pot - rakeTotal;
    winner.stack += amount;
    winner.won += amount;
    if (rakeTotal > 0) events.push({ type: "rake", amount: rakeTotal });
    events.push({ type: "win", seat: winner.idx, amount, potIndex: 0 });
  } else {
    // ショーダウン: サイドポットを積層で計算
    const scores = new Map<number, number>();
    for (const s of alive) {
      const score = evaluate7([...s.hole, ...board]);
      scores.set(s.idx, score);
      s.showedDown = true;
      events.push({ type: "showdown", seat: s.idx, cards: s.hole.map(cardToString), score });
    }
    if (rakeTotal > 0) events.push({ type: "rake", amount: rakeTotal });

    const levels = [...new Set(seats.filter((s) => s.committed > 0).map((s) => s.committed))].sort((a, b) => a - b);
    let prev = 0;
    let rakeLeft = rakeTotal;
    let potIndex = 0;
    for (const level of levels) {
      let amount = 0;
      for (const s of seats) amount += Math.max(0, Math.min(s.committed, level) - prev);
      prev = level;
      if (amount === 0) continue;
      // レーキはメインポット(最初の層)から順に控除
      const rakeHere = Math.min(rakeLeft, amount);
      rakeLeft -= rakeHere;
      amount -= rakeHere;
      const eligible = alive.filter((s) => s.committed >= level);
      if (eligible.length === 0 || amount === 0) continue;
      let best = -1;
      for (const s of eligible) best = Math.max(best, scores.get(s.idx)!);
      const winners = eligible
        .filter((s) => scores.get(s.idx) === best)
        .sort((a, b) => distFromButton(a.idx) - distFromButton(b.idx));
      const share = Math.floor(amount / winners.length);
      let remainder = amount - share * winners.length;
      for (const w of winners) {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        const winAmount = share + extra;
        w.stack += winAmount;
        w.won += winAmount;
        events.push({ type: "win", seat: w.idx, amount: winAmount, potIndex });
      }
      potIndex++;
    }
  }

  function distFromButton(idx: number): number {
    return (idx - config.button - 1 + n) % n;
  }

  return {
    handId,
    board: board.map(cardToString),
    totalPot: pot,
    rake: rakeTotal,
    events,
    seats: seats.map((s) => ({
      seat: s.idx,
      id: s.id,
      holeCards: s.hole.map(cardToString),
      committed: s.committed,
      won: s.won,
      net: s.won - s.committed,
      folded: s.folded,
      showedDown: s.showedDown,
    })),
  };
}
