import type { ActRequest, ActResponse, Street } from "@poker-arena/protocol";
import { Agent, Card, categoryOf, evaluate5, evaluate7, mulberry32, parseCard } from "@poker-arena/engine";

/**
 * ベンチマーク bot 群。開発中の bot の強さを段階的に測るための練習相手。
 *
 * シーズン1 は **ヘッズアップ**(2人)NLH、100bb、SB 50 / BB 100、レーキ 5% cap 400。
 * HU ではボタン = SB で、プリフロップは先行・ポストフロップは後手になる。
 * `tight` / `lag` / `balanced` はこの構造を前提にしたレンジ・サイジングを持つ。
 *
 * 全ての bot は
 *  - 同じシードなら決定的(内部状態を持たず、ハンドID+席+用途のハッシュから乱数を作る)
 *  - 非合法アクションを返さない(最終的に `sanitize` を通す)
 *  - 例外を投げない(`safeAgent` が握り潰して check/fold にフォールバック)
 * ことを保証する。
 */

// ---------------------------------------------------------------------------
// 合法アクション
// ---------------------------------------------------------------------------

interface Legal {
  fold: boolean;
  check: boolean;
  call?: { action: "call"; amount: number };
  raise?: { action: "raise"; min: number; max: number };
}

const legalOf = (req: ActRequest): Legal => {
  const call = req.legal_actions.find((l) => l.action === "call");
  const raise = req.legal_actions.find((l) => l.action === "raise");
  return {
    fold: req.legal_actions.some((l) => l.action === "fold"),
    check: req.legal_actions.some((l) => l.action === "check"),
    call: call?.action === "call" ? call : undefined,
    raise: raise?.action === "raise" ? raise : undefined,
  };
};

/** 望んだアクションを必ず合法なアクションへ落とし込む(降格順: raise → call → check → fold) */
function sanitize(res: ActResponse | undefined, L: Legal): ActResponse {
  const fallback = (): ActResponse =>
    L.check ? { action: "check" } : L.fold ? { action: "fold" } : L.call ? { action: "call" } : { action: "fold" };
  if (!res || typeof res !== "object") return fallback();

  if (res.action === "raise") {
    if (L.raise) {
      const n = Math.round(res.amount);
      const amount = Number.isFinite(n) ? Math.max(L.raise.min, Math.min(L.raise.max, n)) : L.raise.min;
      return { action: "raise", amount };
    }
    return L.call ? { action: "call" } : fallback();
  }
  if (res.action === "call") return L.call ? { action: "call" } : fallback();
  if (res.action === "check") return L.check ? { action: "check" } : fallback();
  if (res.action === "fold") return L.fold ? { action: "fold" } : fallback();
  return fallback();
}

/** 例外を投げず、非合法アクションも返さないことを保証するラッパ */
function safeAgent(decide: (req: ActRequest, L: Legal) => ActResponse | undefined): Agent {
  return (req: ActRequest): ActResponse => {
    let L: Legal = { fold: false, check: false };
    try {
      L = legalOf(req);
    } catch {
      return { action: "fold" };
    }
    try {
      return sanitize(decide(req, L), L);
    } catch {
      return sanitize(undefined, L);
    }
  };
}

// ---------------------------------------------------------------------------
// 決定的な乱数(状態を持たない)
// ---------------------------------------------------------------------------

/**
 * seed + hand_id + seat + salt から [0,1) を作る。
 * 同一ストリート内では何度呼んでも同じ値になるので、
 * 「フロップでブラフを打ったらターンでも撃ち続ける」といった一貫性が保てる。
 */
function roll(seed: number, req: ActRequest, salt: number): number {
  let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  const s = `${req.hand_id}|${req.seat}|${salt}`;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return mulberry32(h)();
}

const STREET_SALT: Record<Street, number> = { preflop: 10, flop: 20, turn: 30, river: 40 };

// ---------------------------------------------------------------------------
// プリフロップ: 169 ハンドを「上位何割か」に写像する
// ---------------------------------------------------------------------------

const RANK_LABELS = "23456789TJQKA";

function handKey(hi: number, lo: number, suited: boolean): string {
  return hi === lo
    ? `${RANK_LABELS[hi]}${RANK_LABELS[lo]}`
    : `${RANK_LABELS[hi]}${RANK_LABELS[lo]}${suited ? "s" : "o"}`;
}

/** Chen フォーミュラ(丸めなし。順序付けにしか使わないので端数はそのまま持つ) */
function chenScore(hi: number, lo: number, suited: boolean): number {
  const pts = (r: number): number => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
  const pair = hi === lo;
  let score = pts(hi);
  if (pair) score = Math.max(score * 2, 5);
  if (suited) score += 2;
  if (!pair) {
    const gap = hi - lo - 1;
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;
    // ギャップ0/1 かつ両方 Q 未満(= J 以下)ならコネクター補正
    if (gap <= 1 && hi < 10) score += 1;
  }
  return score;
}

/**
 * ハンド → 「上位 x 割」(0 < x <= 1)。
 * 1326 コンボを Chen 順に並べた累積比率なので、`top <= 0.8` は素直に「上位80%」を意味する。
 */
const TOP_FRACTION: ReadonlyMap<string, number> = (() => {
  interface Row {
    key: string;
    chen: number;
    hi: number;
    lo: number;
    suited: boolean;
    combos: number;
  }
  const rows: Row[] = [];
  for (let hi = 0; hi < 13; hi++) {
    for (let lo = 0; lo <= hi; lo++) {
      if (hi === lo) {
        rows.push({ key: handKey(hi, lo, false), chen: chenScore(hi, lo, false), hi, lo, suited: false, combos: 6 });
      } else {
        rows.push({ key: handKey(hi, lo, true), chen: chenScore(hi, lo, true), hi, lo, suited: true, combos: 4 });
        rows.push({ key: handKey(hi, lo, false), chen: chenScore(hi, lo, false), hi, lo, suited: false, combos: 12 });
      }
    }
  }
  rows.sort(
    (a, b) => b.chen - a.chen || b.hi - a.hi || b.lo - a.lo || Number(b.suited) - Number(a.suited),
  );
  const total = rows.reduce((acc, r) => acc + r.combos, 0); // 1326
  const map = new Map<string, number>();
  let cum = 0;
  for (const r of rows) {
    cum += r.combos;
    map.set(r.key, cum / total);
  }
  return map;
})();

function preflopTop(hole: readonly Card[]): number {
  const a = hole[0];
  const b = hole[1];
  if (a === undefined || b === undefined) return 1;
  const r1 = a >> 2;
  const r2 = b >> 2;
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const suited = hi !== lo && (a & 3) === (b & 3);
  return TOP_FRACTION.get(handKey(hi, lo, suited)) ?? 1;
}

// ---------------------------------------------------------------------------
// ポストフロップ: ハンド評価器で作った強さ(0..1)
// ---------------------------------------------------------------------------

const CATEGORY_INDEX = {
  "high card": 0,
  pair: 1,
  "two pair": 2,
  trips: 3,
  straight: 4,
  flush: 5,
  "full house": 6,
  quads: 7,
  "straight flush": 8,
} as const;

/** 5〜7枚から最強5枚の評価値。エンジンの evaluate5/evaluate7 を使う */
function bestScore(cards: readonly Card[]): number {
  const n = cards.length;
  if (n < 5) return -1;
  if (n === 5) return evaluate5(cards);
  if (n === 7) return evaluate7(cards);
  let best = -1;
  for (let skip = 0; skip < n; skip++) {
    const sub: Card[] = [];
    for (let i = 0; i < n; i++) if (i !== skip) sub.push(cards[i]!);
    const s = evaluate5(sub);
    if (s > best) best = s;
  }
  return best;
}

function categoryIndex(score: number): number {
  return CATEGORY_INDEX[categoryOf(score)];
}

function hasStraight(ranks: ReadonlySet<number>): boolean {
  // high = 3 は 5-high(A-2-3-4-5)。r === -1 は A の下側。
  for (let high = 3; high <= 12; high++) {
    let ok = true;
    for (let k = 0; k < 5; k++) {
      const r = high - k;
      if (!ranks.has(r === -1 ? 12 : r)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** ストレートを完成させるランクの数(0=ドローなし, 1=ガットショット, 2+=オープンエンド相当) */
function straightOuts(ranks: ReadonlySet<number>): number {
  if (hasStraight(ranks)) return 0;
  let outs = 0;
  for (let r = 0; r < 13; r++) {
    if (ranks.has(r)) continue;
    const t = new Set(ranks);
    t.add(r);
    if (hasStraight(t)) outs++;
  }
  return outs;
}

/** 自分のホールカードを含むフラッシュドロー(同スート4枚)か */
function hasFlushDraw(hole: readonly Card[], board: readonly Card[]): boolean {
  const all = [0, 0, 0, 0];
  const mine = [0, 0, 0, 0];
  for (const c of board) all[c & 3]!++;
  for (const c of hole) {
    all[c & 3]!++;
    mine[c & 3]!++;
  }
  for (let s = 0; s < 4; s++) if (all[s]! === 4 && mine[s]! >= 1) return true;
  return false;
}

/**
 * ポストフロップの手の強さ(0..1)。
 * 「自分のランクがボードに出ているか」ではなく、実際の役カテゴリ + ボードとの相対位置
 * (オーバーペア / トップペア / 2nd ペア / ボードのペアを借りているだけ …)で判定する。
 * フロップ・ターンではドローの価値を上乗せする。
 */
function postflopStrength(hole: readonly Card[], board: readonly Card[]): number {
  if (board.length < 3 || hole.length < 2) return 0;
  const all = [...hole, ...board];
  const score = bestScore(all);
  if (score < 0) return 0;
  const cat = categoryIndex(score);

  const hr = [hole[0]! >> 2, hole[1]! >> 2].sort((a, b) => b - a) as [number, number];
  const boardRankList = board.map((c) => c >> 2);
  const boardRanks = [...new Set(boardRankList)].sort((a, b) => b - a);
  const countOnBoard = (r: number) => boardRankList.filter((x) => x === r).length;
  const pocket = hr[0] === hr[1];

  let base: number;
  if (cat >= 6) {
    base = 0.98;
  } else if (cat === 5) {
    base = 0.93;
  } else if (cat === 4) {
    base = 0.9;
  } else if (cat === 3) {
    base = boardRanks.some((r) => countOnBoard(r) >= 3) ? 0.55 : 0.87; // ボードのトリップスは弱い
  } else if (cat === 2) {
    const boardPairs = boardRanks.filter((r) => countOnBoard(r) >= 2).length;
    base = boardPairs >= 2 ? 0.3 : boardPairs === 1 ? 0.55 : 0.78;
  } else if (cat === 1) {
    if (pocket) {
      const top = boardRanks[0] ?? -1;
      const second = boardRanks[1] ?? -1;
      if (hr[0] > top) base = 0.74; // オーバーペア
      else if (hr[0] > second) base = 0.5; // ミドルポケット
      else base = 0.34; // アンダーペア
    } else {
      const hit = hr.filter((r) => boardRanks.includes(r));
      const pairedRank = hit[0];
      if (pairedRank === undefined) {
        // ボードのペアを借りているだけ(実質ハイカード)
        base = hr[0] === 12 ? 0.24 : hr[0] >= 10 ? 0.19 : 0.14;
      } else {
        const idx = boardRanks.indexOf(pairedRank);
        const kicker = hr[0] === pairedRank ? hr[1] : hr[0];
        if (idx === 0) base = 0.6 + (kicker === 12 ? 0.1 : kicker >= 10 ? 0.06 : kicker >= 8 ? 0.03 : 0);
        else if (idx === 1) base = 0.46;
        else base = 0.34;
      }
    }
  } else {
    base = hr[0] === 12 ? 0.22 : hr[0] >= 10 ? 0.16 : 0.1;
  }

  // ボードだけで完成している役(自分のカードが一切効いていない)
  if (board.length === 5 && bestScore(board) === score) base = Math.min(base, 0.15);

  // フロップ・ターンはドローを加点
  if (board.length === 3 || board.length === 4) {
    let bonus = 0;
    if (cat < 4) {
      const allRanks = new Set(all.map((c) => c >> 2));
      const bRanks = new Set(boardRankList);
      const outs = Math.max(0, straightOuts(allRanks) - straightOuts(bRanks));
      if (hasFlushDraw(hole, board)) bonus += 0.32;
      if (outs >= 2) bonus += 0.26;
      else if (outs === 1) bonus += 0.1;
      // 完全なノーペアだが2オーバーカード
      if (cat === 0 && bonus === 0 && hr[1] > (boardRanks[0] ?? 12)) bonus += 0.06;
    }
    base = Math.min(0.92, base + bonus);
  }

  return base;
}

// ---------------------------------------------------------------------------
// リクエストから読み取るヘルパ
// ---------------------------------------------------------------------------

function holeOf(req: ActRequest): Card[] {
  return req.hole_cards.map(parseCard);
}

function boardOf(req: ActRequest): Card[] {
  return req.board.map(parseCard);
}

function meOf(req: ActRequest) {
  return req.players.find((p) => p.seat === req.seat);
}

function bigBlindOf(req: ActRequest): number {
  const bb = req.actions.find((a) => a.action === "post_bb")?.amount;
  return bb && bb > 0 ? bb : 100;
}

/** HU ではボタン = SB。ポストフロップで後手(ポジションあり)かどうかと同義。 */
function isButton(req: ActRequest): boolean {
  const sb = req.actions.find((a) => a.action === "post_sb");
  return sb ? sb.seat === req.seat : false;
}

/** 直近の bet/raise が自分か(= イニシアチブを持っているか) */
function hasInitiative(req: ActRequest): boolean {
  for (let i = req.actions.length - 1; i >= 0; i--) {
    const a = req.actions[i]!;
    if (a.action === "bet" || a.action === "raise") return a.seat === req.seat;
  }
  return false;
}

function raisesThisStreet(req: ActRequest): number {
  return req.actions.filter((a) => a.street === req.street && (a.action === "bet" || a.action === "raise")).length;
}

/** 絶対額を raise-to として合法域にクランプ */
function raiseTo(L: Legal, amount: number): ActResponse {
  if (!L.raise) return { action: "call" };
  const n = Math.round(amount);
  return {
    action: "raise",
    amount: Math.max(L.raise.min, Math.min(L.raise.max, Number.isFinite(n) ? n : L.raise.min)),
  };
}

/** ポットの `fraction` 倍を上乗せするレイズ(fraction=1 でポットサイズレイズ) */
function potRaise(req: ActRequest, L: Legal, fraction: number): ActResponse {
  const toCall = L.call?.amount ?? 0;
  const myBet = meOf(req)?.bet ?? 0;
  return raiseTo(L, myBet + toCall + fraction * (req.pot + toCall));
}

// ---------------------------------------------------------------------------
// スタイル定義
// ---------------------------------------------------------------------------

interface Style {
  /** ボタン(SB)のオープンレンジ(上位割合)とサイズ(bb) */
  openTop: number;
  openBb: number;
  /** オープンしない中でリンプに回す上限。openTop と同値ならリンプなし */
  limpTop: number;
  /** BB がリンプに対してレイズする範囲とサイズ(bb) */
  isoTop: number;
  isoBb: number;
  /** オープンに直面したときの 3bet / コールレンジ */
  threeBetTop: number;
  defendTop: number;
  /** 3bet に直面したときの 4bet / コールレンジ */
  fourBetTop: number;
  call3betTop: number;
  /** 4bet 以上に直面したときのコールレンジ(その 0.6 倍でオールイン) */
  call4betTop: number;

  /** ベット/レイズのサイズ(ポット比) */
  betSize: number;
  bluffSize: number;
  /** ノーベット時にバリューベットする強さ */
  valueBet: number;
  /** アグレッサーとして継続ベットする最低強さ(セミブラフ込み) */
  semiBluff: number;
  /** これ未満はバリューがない = 諦めるかブラフに回す */
  giveUp: number;
  /** ベットに直面してレイズし返す強さ */
  raiseValue: number;
  /** コールに要求する追加エクイティ */
  callMargin: number;
  /** ブラフ頻度(シード由来・固定頻度) */
  bluffFreq: number;
  bluffRaiseFreq: number;
}

const TIGHT: Style = {
  openTop: 0.92,
  openBb: 2.5,
  limpTop: 0.92,
  isoTop: 0.45,
  isoBb: 3.5,
  threeBetTop: 0.13,
  defendTop: 0.6,
  fourBetTop: 0.04,
  call3betTop: 0.2,
  call4betTop: 0.03,
  betSize: 0.72,
  bluffSize: 0.68,
  valueBet: 0.6,
  semiBluff: 0.32,
  giveUp: 0.28,
  raiseValue: 0.82,
  callMargin: 0.06,
  bluffFreq: 0.12,
  bluffRaiseFreq: 0.04,
};

const LAG: Style = {
  openTop: 0.96,
  openBb: 2.5,
  limpTop: 0.96,
  isoTop: 0.7,
  isoBb: 3.5,
  threeBetTop: 0.26,
  defendTop: 0.82,
  fourBetTop: 0.075,
  call3betTop: 0.36,
  call4betTop: 0.05,
  betSize: 0.78,
  bluffSize: 0.8,
  valueBet: 0.46,
  semiBluff: 0.2,
  giveUp: 0.36,
  raiseValue: 0.72,
  callMargin: -0.01,
  bluffFreq: 0.5,
  bluffRaiseFreq: 0.18,
};

const BALANCED: Style = {
  openTop: 0.85,
  openBb: 2.5,
  limpTop: 0.88,
  isoTop: 0.55,
  isoBb: 3.5,
  threeBetTop: 0.18,
  defendTop: 0.63,
  fourBetTop: 0.055,
  call3betTop: 0.27,
  call4betTop: 0.035,
  betSize: 0.66,
  bluffSize: 0.62,
  valueBet: 0.56,
  semiBluff: 0.29,
  giveUp: 0.32,
  raiseValue: 0.81,
  callMargin: 0.05,
  bluffFreq: 0.3,
  bluffRaiseFreq: 0.1,
};

// ---------------------------------------------------------------------------
// 意思決定
// ---------------------------------------------------------------------------

function preflopDecision(req: ActRequest, L: Legal, style: Style, hole: Card[]): ActResponse {
  const bb = bigBlindOf(req);
  const top = preflopTop(hole);
  const raises = raisesThisStreet(req);
  const toCall = L.call?.amount ?? 0;
  const myStack = meOf(req)?.stack ?? 0;

  if (raises === 0) {
    if (toCall > 0) {
      // ボタン(SB)の初手
      if (top <= style.openTop && L.raise) return raiseTo(L, style.openBb * bb);
      if (top <= style.limpTop && L.call) return { action: "call" };
      return { action: "fold" };
    }
    // BB のオプション(相手がリンプ)
    if (top <= style.isoTop && L.raise) return raiseTo(L, style.isoBb * bb);
    return { action: "check" };
  }

  // 相手のベットがスタックに対して大きいほどレンジを締める
  const commit = toCall / Math.max(1, myStack + toCall);
  const tighten = commit > 0.5 ? 0.35 : commit > 0.25 ? 0.65 : 1;

  if (raises === 1) {
    if (top <= style.threeBetTop && L.raise) return potRaise(req, L, 1);
    if (top <= style.defendTop * tighten && L.call) return { action: "call" };
    return L.check ? { action: "check" } : { action: "fold" };
  }
  if (raises === 2) {
    if (top <= style.fourBetTop && L.raise) return potRaise(req, L, 0.6);
    if (top <= style.call3betTop * tighten && L.call) return { action: "call" };
    return L.check ? { action: "check" } : { action: "fold" };
  }
  // 4bet 以上
  if (top <= style.call4betTop * 0.6 && L.raise) return raiseTo(L, L.raise.max);
  if (top <= style.call4betTop && L.call) return { action: "call" };
  return L.check ? { action: "check" } : { action: "fold" };
}

function postflopDecision(
  req: ActRequest,
  L: Legal,
  style: Style,
  seed: number,
  hole: Card[],
  board: Card[],
): ActResponse {
  const s = postflopStrength(hole, board);
  const toCall = L.call?.amount ?? 0;
  const myStack = meOf(req)?.stack ?? 0;
  const aggressor = hasInitiative(req);
  const ip = isButton(req);
  const salt = STREET_SALT[req.street];
  const bluffRoll = roll(seed, req, salt);
  const raiseRoll = roll(seed, req, salt + 1);

  if (toCall === 0) {
    if (!L.raise) return { action: "check" };
    // バリューベット
    if (s >= style.valueBet) return potRaise(req, L, style.betSize);
    // アグレッサーの継続ベット(ドロー込み)。リバーでドローはもう価値がない
    if (aggressor && req.street !== "river" && s >= style.semiBluff) return potRaise(req, L, style.betSize);
    // 固定頻度のブラフ。悪いランナウトで諦めるハンドの一部だけを撃つ
    if (s < style.giveUp && (aggressor || ip) && bluffRoll < style.bluffFreq) {
      return potRaise(req, L, style.bluffSize);
    }
    return { action: "check" };
  }

  const price = toCall / Math.max(1, req.pot + toCall);
  const commit = toCall / Math.max(1, myStack + toCall);
  const need = price + style.callMargin + 0.18 * commit;

  if (L.raise && s >= style.raiseValue) return potRaise(req, L, style.betSize);
  if (s >= need) return { action: "call" };
  if (
    L.raise &&
    req.street !== "river" &&
    s < style.giveUp &&
    commit < 0.4 &&
    raiseRoll < style.bluffRaiseFreq
  ) {
    return potRaise(req, L, style.bluffSize);
  }
  return L.check ? { action: "check" } : { action: "fold" };
}

function styleBot(style: Style, seed: number): Agent {
  return safeAgent((req, L) => {
    const hole = holeOf(req);
    if (hole.length < 2) return undefined;
    if (req.street === "preflop") return preflopDecision(req, L, style, hole);
    return postflopDecision(req, L, style, seed, hole, boardOf(req));
  });
}

// ---------------------------------------------------------------------------
// ベンチマーク bot
// ---------------------------------------------------------------------------

/** check できるなら check、できなければ fold */
export function checkFoldBot(): Agent {
  return safeAgent((_req, L) => (L.check ? { action: "check" } : { action: "fold" }));
}

/** 常に call / check */
export function callBot(): Agent {
  return safeAgent((_req, L) => {
    if (L.call) return { action: "call" };
    if (L.check) return { action: "check" };
    return { action: "fold" };
  });
}

/** シード付きランダム: check/call 60%、min raise 25%、fold 15% */
export function randomBot(seed: number): Agent {
  const rng = mulberry32(seed);
  return safeAgent((_req, L) => {
    const r = rng();
    if (L.raise && r < 0.25) return { action: "raise", amount: L.raise.min };
    if (r < 0.85) {
      if (L.call) return { action: "call" };
      if (L.check) return { action: "check" };
    }
    if (L.check) return { action: "check" };
    return { action: "fold" };
  });
}

/** 高頻度で min raise、たまにポットサイズレイズ */
export function aggroBot(seed: number): Agent {
  const rng = mulberry32(seed);
  return safeAgent((req, L) => {
    if (L.raise) {
      const r = rng();
      if (r < 0.5) {
        const target = r < 0.15 ? Math.min(L.raise.max, L.raise.min + req.pot) : L.raise.min;
        return { action: "raise", amount: target };
      }
    }
    if (L.call) return { action: "call" };
    if (L.check) return { action: "check" };
    return { action: "fold" };
  });
}

/**
 * タイト・アグレッシブ(HU 用)。
 * ボタンは上位 92% をオープン(HU ではボタンはほぼ全ハンドで参加する)、BB も広くディフェンス。
 * ポストフロップは役評価に基づくバリューベット + ポット比の継続ベット、
 * 悪いランナウト(自分のペアがオーバーカードに抜かれた等)ではきちんと降りる。
 */
export function tightBot(seed = 0): Agent {
  return styleBot(TIGHT, seed);
}

/**
 * ルース・アグレッシブ。ボタンはほぼ全ハンドをオープンし、
 * 大きめのサイズで撃ち続ける。ブラフ頻度が高くコールも軽い。
 */
export function lagBot(seed: number): Agent {
  return styleBot(LAG, seed);
}

/**
 * バランス型。TAG に近いレンジを持ちつつ、シードから決まる固定頻度
 * (30% のブラフ / 10% のブラフレイズ)で弱いハンドを混ぜる。
 * 同じシード・同じハンドなら常に同じ選択をする。
 */
export function balancedBot(seed: number): Agent {
  return styleBot(BALANCED, seed);
}

export type BotName = "fold" | "call" | "random" | "aggro" | "tight" | "lag" | "balanced";

export const BOT_NAMES: readonly BotName[] = ["fold", "call", "random", "aggro", "tight", "lag", "balanced"];

export function makeBot(name: BotName, seed: number): Agent {
  switch (name) {
    case "fold":
      return checkFoldBot();
    case "call":
      return callBot();
    case "random":
      return randomBot(seed);
    case "aggro":
      return aggroBot(seed);
    case "tight":
      return tightBot(seed);
    case "lag":
      return lagBot(seed);
    case "balanced":
      return balancedBot(seed);
  }
}
