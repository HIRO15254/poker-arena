/**
 * 人間 vs bot のヘッズアップ NLH。サーバー権威。
 * セッション id は localStorage に保存し、リロード時は GET /api/play/:id で復元する。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LegalAction, PlayActRequest, PlaySeatView, PlaySession } from "@poker-arena/protocol";
import { ApiRequestError, api } from "../api";
import { PokerTable } from "../components/PokerTable";
import type { TableSeatDisplay } from "../components/PokerTable";
import { ActionHistory } from "../components/ActionHistory";
import { PlayingCard } from "../components/Card";
import { ErrorState, InlineError, LoadingState } from "../components/States";
import { IconAlert, IconCards, IconLogout, IconPlay } from "../components/Icons";
import {
  bb,
  bbLabel,
  bbToChips,
  chipsToBb,
  integer,
  signClass,
  signedBb,
  signedNumber,
} from "../format";
import { BUILTIN_STRATEGIES } from "../builtins";

const SESSION_KEY = "poker-arena.playSessionId";

interface OpponentOption {
  id: string;
  label: string;
  description: string;
}

const OPPONENTS: OpponentOption[] = BUILTIN_STRATEGIES;

type CallAction = Extract<LegalAction, { action: "call" }>;
type RaiseAction = Extract<LegalAction, { action: "raise" }>;

function findAction<K extends LegalAction["action"]>(
  actions: LegalAction[],
  kind: K,
): Extract<LegalAction, { action: K }> | undefined {
  return actions.find((a): a is Extract<LegalAction, { action: K }> => a.action === kind);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toDisplaySeat(seat: PlaySeatView, toAct: number | null): TableSeatDisplay {
  return {
    seat: seat.seat,
    name: seat.name,
    stack: seat.stack,
    bet: seat.bet,
    status: seat.status,
    cards: seat.cards,
    isButton: seat.isButton,
    isHero: seat.isHero,
    toAct: toAct === seat.seat,
    position: seat.position,
  };
}

// ---------- 対戦相手ピッカー ----------

function OpponentPicker({
  onStart,
  busy,
  error,
}: {
  onStart: (opponent: string) => void;
  busy: boolean;
  error: unknown;
}) {
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<string>("tight");

  return (
    <div className="main">
      <header className="top">
        <h1>プレイ</h1>
        <span className="bdg bdg-outline">ヘッズアップ NLH · 100bb</span>
      </header>
      <div className="center-page">
        <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ fontSize: 17 }}>対戦相手を選ぶ</h2>
            <span className="meta">
              スタックは毎ハンド <span className="mono">100bb</span> にリセット。ブラインドは{" "}
              <span className="mono">0.5</span> / <span className="mono">1.0</span> bb。
            </span>
          </div>

          <div className="opp-grid">
            {OPPONENTS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={selected === opt.id ? "opp-card on" : "opp-card"}
                onClick={() => setSelected(opt.id)}
                aria-pressed={selected === opt.id}
              >
                <span className="avt avt-lg">{opt.label.slice(0, 2)}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span className="mono" style={{ fontWeight: 500 }}>
                    {opt.label}
                  </span>
                  <span className="meta">{opt.description}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="crd" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="custom-opponent">
                bot id を直接指定する(任意)
              </label>
              <input
                id="custom-opponent"
                className="inp mono"
                value={custom}
                placeholder="b_01J8QXKD..."
                onChange={(e) => setCustom(e.target.value)}
              />
            </div>
            <div className="notice">
              <IconAlert className="icn14" />
              <span>
                builtin 戦略のほか、登録済み bot の id を指定して対戦できる。指定した場合はそちらが優先される。
              </span>
            </div>
          </div>

          {error !== null && <InlineError error={error} />}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-pri btn-lg"
              disabled={busy}
              onClick={() => onStart(custom.trim().length > 0 ? custom.trim() : selected)}
            >
              <IconPlay className="icn14" />
              {busy ? "開始中" : "対戦を開始"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 操作バー ----------

function ActionBar({
  session,
  hero,
  villain,
  busy,
  onAct,
  onNext,
  error,
}: {
  session: PlaySession;
  hero: PlaySeatView | null;
  villain: PlaySeatView | null;
  busy: boolean;
  onAct: (action: PlayActRequest["action"], amount?: number) => void;
  onNext: () => void;
  error: unknown;
}) {
  const legal = session.legalActions;
  const canFold = findAction(legal, "fold") !== undefined;
  const canCheck = findAction(legal, "check") !== undefined;
  const callAction: CallAction | undefined = findAction(legal, "call");
  const raiseAction: RaiseAction | undefined = findAction(legal, "raise");

  const heroBet = hero?.bet ?? 0;
  const villainBet = villain?.bet ?? 0;
  const toCall = Math.max(0, villainBet - heroBet);
  // API の pot は現ストリートのベットを含む総額。
  const totalPot = session.pot;

  const presetRaiseTo = useCallback(
    (fraction: number): number | null => {
      if (!raiseAction) return null;
      const raw = heroBet + toCall + (totalPot + toCall) * fraction;
      const rounded = Math.round(raw / 10) * 10;
      return clamp(rounded, raiseAction.min, raiseAction.max);
    },
    [raiseAction, heroBet, toCall, totalPot],
  );

  const [raiseTo, setRaiseTo] = useState<number>(0);
  const keyRef = useRef<string>("");
  const stateKey = raiseAction
    ? `${session.handId}:${session.actions.length}:${raiseAction.min}:${raiseAction.max}`
    : "";

  useEffect(() => {
    if (!raiseAction) return;
    if (keyRef.current === stateKey) return;
    keyRef.current = stateKey;
    const half = presetRaiseTo(0.5);
    setRaiseTo(half ?? raiseAction.min);
  }, [stateKey, raiseAction, presetRaiseTo]);

  const isOver = session.phase === "hand_over";

  if (isOver) {
    const result = session.lastHand;
    return (
      <div className="actbar">
        {error !== null && <InlineError error={error} />}
        {result && (
          <div className="result-bar">
            <span className={`num ${signClass(result.heroNet)}`} style={{ fontSize: 17, fontWeight: 600 }}>
              {signedBb(result.heroNet)}bb
            </span>
            <span className="meta">
              ポット <span className="mono">{bbLabel(result.pot)}</span> · レーキ{" "}
              <span className="mono">{bbLabel(result.rake, 2)}</span> ·{" "}
              {result.foldedOut ? "フォールド決着" : "ショーダウン"}
            </span>
            <span className="meta">
              勝者{" "}
              <span className="mono">
                {result.winners
                  .map((seat) => session.seats.find((s) => s.seat === seat)?.name ?? `seat ${seat}`)
                  .join(", ")}
              </span>
            </span>
            <div className="spacer" />
            {result.reveals.map((reveal) => (
              <span key={reveal.seat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="meta mono">
                  {session.seats.find((s) => s.seat === reveal.seat)?.name ?? `seat ${reveal.seat}`}
                </span>
                {reveal.cards.map((c, i) => (
                  <PlayingCard key={`${c}-${i}`} card={c} size="sm" />
                ))}
                <span className="meta">{reveal.category}</span>
              </span>
            ))}
          </div>
        )}
        <div className="actbar-row">
          <button type="button" className="btn btn-pri btn-lg" disabled={busy} onClick={onNext}>
            <IconPlay className="icn14" />
            {busy ? "配牌中" : "次のハンド"}
          </button>
          <span className="meta">
            ハンド <span className="mono">{integer(session.handNumber)}</span> 終了
          </span>
        </div>
      </div>
    );
  }

  if (legal.length === 0) {
    return (
      <div className="actbar">
        {error !== null && <InlineError error={error} />}
        <div className="actbar-row">
          <span className="meta">相手のアクション待ち</span>
        </div>
      </div>
    );
  }

  const raiseIsAllIn = raiseAction !== undefined && raiseTo >= raiseAction.max;
  const raiseVerb = toCall === 0 && villainBet === 0 ? "ベット" : "レイズ";

  return (
    <div className="actbar">
      {error !== null && <InlineError error={error} />}

      {raiseAction && (
        <div className="actbar-row">
          <span className="meta" style={{ width: 60 }}>
            レイズ額
          </span>
          <button
            type="button"
            className="preset"
            disabled={busy}
            onClick={() => setRaiseTo(raiseAction.min)}
          >
            min
          </button>
          {[
            { label: "1/3 ポット", f: 1 / 3 },
            { label: "1/2 ポット", f: 0.5 },
            { label: "ポット", f: 1 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="preset"
              disabled={busy}
              onClick={() => {
                const value = presetRaiseTo(preset.f);
                if (value !== null) setRaiseTo(value);
              }}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="preset"
            disabled={busy}
            onClick={() => setRaiseTo(raiseAction.max)}
          >
            オールイン
          </button>
          <input
            className="slider"
            type="range"
            min={raiseAction.min}
            max={raiseAction.max}
            step={10}
            value={clamp(raiseTo, raiseAction.min, raiseAction.max)}
            disabled={busy}
            aria-label="レイズ額 (bb)"
            onChange={(e) => setRaiseTo(clamp(Number(e.target.value), raiseAction.min, raiseAction.max))}
          />
          <input
            className="amount-input"
            type="number"
            step={0.1}
            min={chipsToBb(raiseAction.min)}
            max={chipsToBb(raiseAction.max)}
            value={chipsToBb(clamp(raiseTo, raiseAction.min, raiseAction.max)).toFixed(1)}
            disabled={busy}
            aria-label="レイズ額を bb で入力"
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isNaN(parsed)) return;
              setRaiseTo(clamp(bbToChips(parsed), raiseAction.min, raiseAction.max));
            }}
          />
          <span className="meta mono">
            {bb(raiseAction.min)} – {bb(raiseAction.max)} bb
          </span>
        </div>
      )}

      <div className="actbar-row">
        {canFold && (
          <button
            type="button"
            className="act-btn act-fold"
            disabled={busy}
            onClick={() => onAct("fold")}
          >
            フォールド
          </button>
        )}
        {canCheck && (
          <button type="button" className="act-btn" disabled={busy} onClick={() => onAct("check")}>
            チェック
          </button>
        )}
        {callAction && (
          <button type="button" className="act-btn" disabled={busy} onClick={() => onAct("call")}>
            コール
            <small>{bbLabel(callAction.amount)}</small>
          </button>
        )}
        {raiseAction && (
          <button
            type="button"
            className="act-btn act-raise"
            disabled={busy}
            onClick={() => onAct("raise", clamp(raiseTo, raiseAction.min, raiseAction.max))}
          >
            {raiseIsAllIn ? "オールイン" : raiseVerb}
            <small>{bbLabel(clamp(raiseTo, raiseAction.min, raiseAction.max))}</small>
          </button>
        )}
        <div className="spacer" />
        {toCall > 0 && (
          <span className="meta">
            コール額 <span className="mono">{bbLabel(toCall)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- ページ ----------

export function PlayPage() {
  const [session, setSession] = useState<PlaySession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fatalError, setFatalError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const restore = useCallback(() => {
    let id: string | null = null;
    try {
      id = window.localStorage.getItem(SESSION_KEY);
    } catch {
      id = null;
    }
    if (!id) {
      setRestoring(false);
      return () => undefined;
    }

    let cancelled = false;
    setRestoring(true);
    setFatalError(null);
    api
      .getPlay(id)
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.isNotFound) {
          window.localStorage.removeItem(SESSION_KEY);
        } else {
          setFatalError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => restore(), [restore]);

  const start = useCallback(async (opponent: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const created = await api.createPlay({ opponent });
      try {
        window.localStorage.setItem(SESSION_KEY, created.id);
      } catch {
        /* ignore */
      }
      setSession(created);
      setFatalError(null);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }, []);

  const act = useCallback(
    async (action: PlayActRequest["action"], amount?: number) => {
      if (!session) return;
      setBusy(true);
      setActionError(null);
      try {
        setSession(await api.act(session.id, amount === undefined ? { action } : { action, amount }));
      } catch (err) {
        setActionError(err);
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  const nextHand = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setActionError(null);
    try {
      setSession(await api.nextHand(session.id));
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }, [session]);

  const quit = useCallback(() => {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
    setActionError(null);
  }, []);

  const hero = useMemo(() => session?.seats.find((s) => s.isHero) ?? null, [session]);
  const villain = useMemo(() => session?.seats.find((s) => !s.isHero) ?? null, [session]);

  if (restoring) {
    return (
      <div className="main">
        <header className="top">
          <h1>プレイ</h1>
        </header>
        <LoadingState label="セッションを復元中" />
      </div>
    );
  }

  if (fatalError !== null && session === null) {
    return (
      <div className="main">
        <header className="top">
          <h1>プレイ</h1>
        </header>
        <ErrorState
          error={fatalError}
          onRetry={restore}
          title="セッションの復元に失敗しました"
        />
        <div style={{ padding: 16 }}>
          <button type="button" className="btn btn-sec" onClick={quit}>
            セッションを破棄して選び直す
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return <OpponentPicker onStart={(o) => void start(o)} busy={busy} error={actionError} />;
  }

  const over = session.phase === "hand_over" ? session.lastHand : null;
  const board = over ? over.board : session.board;
  const pot = over ? over.pot : session.pot;

  // ショーダウンで公開された相手のカードを反映する
  const revealFor = (seat: number): string[] | null =>
    over?.reveals.find((r) => r.seat === seat)?.cards ?? null;

  const topSeat: TableSeatDisplay | null = villain
    ? {
        ...toDisplaySeat(villain, session.toAct),
        cards: villain.cards ?? revealFor(villain.seat),
      }
    : null;
  const bottomSeat: TableSeatDisplay | null = hero
    ? { ...toDisplaySeat(hero, session.toAct), cards: hero.cards ?? revealFor(hero.seat) }
    : null;

  const seatName = (seat: number): string =>
    session.seats.find((s) => s.seat === seat)?.name ?? `seat ${seat}`;

  return (
    <>
      <div className="main">
        <header className="top">
          <h1>プレイ</h1>
          <span className="bdg bdg-outline">
            <span className="mono id-badge">{session.opponentName}</span>
          </span>
          <span className="meta">
            ハンド <span className="mono">{integer(session.handNumber)}</span>
          </span>
          <div className="spacer" />
          <span className="meta">
            ブラインド <span className="mono">{bb(session.smallBlind)}</span> /{" "}
            <span className="mono">{bb(session.bigBlind)}</span> bb
          </span>
          <button type="button" className="btn btn-sec" onClick={quit}>
            <IconLogout className="icn14" />
            セッション終了
          </button>
        </header>

        <div className="stage-wrap">
          <PokerTable
            top={topSeat}
            bottom={bottomSeat}
            board={board}
            pot={pot}
            note={
              session.phase === "acting" && session.toAct !== session.heroSeat
                ? "相手の手番"
                : undefined
            }
          />
        </div>

        <ActionBar
          session={session}
          hero={hero}
          villain={villain}
          busy={busy}
          onAct={(a, amount) => void act(a, amount)}
          onNext={() => void nextHand()}
          error={actionError}
        />
      </div>

      <aside className="panel">
        <div className="panel-head">
          <span>アクション履歴</span>
          <div className="spacer" />
          <span className="meta">金額は bb</span>
        </div>
        <div className="subbar" style={{ height: 44, gap: 16 }}>
          <span>
            ハンド <span className="mono" style={{ color: "var(--foreground)" }}>{integer(session.totals.hands)}</span>
          </span>
          <span>
            収支{" "}
            <span className={`mono ${signClass(session.totals.heroNet)}`}>
              {signedBb(session.totals.heroNet)}bb
            </span>
          </span>
          <span>
            bb/100{" "}
            <span className={`mono ${signClass(session.totals.bb100)}`}>
              {signedNumber(session.totals.bb100)}
            </span>
          </span>
        </div>
        <ActionHistory
          actions={session.actions}
          board={board}
          nameForSeat={seatName}
          heroSeat={session.heroSeat}
          autoScroll
          footer={
            <div
              className="meta"
              style={{ padding: "10px 12px", display: "flex", gap: 6, alignItems: "flex-start" }}
            >
              <IconCards className="icn14" />
              <span>相手のホールカードはショーダウンの公開分のみ表示。</span>
            </div>
          }
        />
      </aside>
    </>
  );
}
