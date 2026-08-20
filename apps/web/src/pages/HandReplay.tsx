/**
 * ハンドリプレイ。アクションを 1 手ずつ進めて盤面を再構築する。
 * ActionRecord.amount は「そのストリートでの合計額」として扱う(protocol の定義)。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { HandDetail, Street } from "@poker-arena/protocol";
import { api, getApiKey } from "../api";
import { useApi } from "../hooks";
import { PokerTable } from "../components/PokerTable";
import type { TableSeatDisplay } from "../components/PokerTable";
import { ActionHistory } from "../components/ActionHistory";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPause,
  IconPlay,
  IconSkipBack,
  IconSkipForward,
} from "../components/Icons";
import { STREET_ORDER, bbLabel, dateTime, signClass, signedBb, streetLabel } from "../format";

interface ReplaySeat {
  seat: number;
  name: string;
  stack: number;
  bet: number;
  committed: number;
  status: "active" | "folded" | "allin";
  holeCards: string[] | null;
}

interface ReplayState {
  seats: ReplaySeat[];
  pot: number;
  street: Street;
  board: string[];
}

function boardLengthFor(street: Street): number {
  switch (street) {
    case "preflop":
      return 0;
    case "flop":
      return 3;
    case "turn":
      return 4;
    case "river":
      return 5;
  }
}

function boardForStreet(hand: HandDetail, street: Street): string[] {
  const expected = boardLengthFor(street);
  const entry = hand.streets.find((s) => s.street === street);
  if (entry && entry.board.length >= expected) return entry.board.slice(0, expected);
  return hand.board.slice(0, expected);
}

function replay(hand: HandDetail, cursor: number): ReplayState {
  const seats: ReplaySeat[] = hand.seats.map((s) => ({
    seat: s.seat,
    name: s.botName,
    stack: s.startingStack,
    bet: 0,
    committed: 0,
    status: "active",
    holeCards: s.holeCards,
  }));
  const bySeat = new Map(seats.map((s) => [s.seat, s]));

  let street: Street = hand.actions[0]?.street ?? "preflop";

  for (let i = 0; i <= cursor && i < hand.actions.length; i += 1) {
    const record = hand.actions[i];
    if (!record) break;
    if (record.street !== street) {
      street = record.street;
      for (const seat of seats) seat.bet = 0;
    }
    const seat = bySeat.get(record.seat);
    if (!seat) continue;

    switch (record.action) {
      case "fold":
        seat.status = "folded";
        break;
      case "check":
        break;
      default: {
        const target = record.amount ?? 0;
        const delta = Math.max(0, target - seat.bet);
        seat.stack = Math.max(0, seat.stack - delta);
        seat.bet = Math.max(seat.bet, target);
        seat.committed += delta;
        if (record.all_in) seat.status = "allin";
        break;
      }
    }
  }

  // PokerTable 側で現ストリートのベット分を差し引くので、ここでは総額を渡す
  const committed = seats.reduce((sum, s) => sum + s.committed, 0);

  // 最終手まで進めた場合は最終ボードを見せる
  const atEnd = cursor >= hand.actions.length - 1;
  const board = atEnd ? hand.board : boardForStreet(hand, street);

  return { seats, pot: committed, street, board };
}

function toDisplay(seat: ReplaySeat, hand: HandDetail): TableSeatDisplay {
  const isHero = seat.seat === hand.seat;
  return {
    seat: seat.seat,
    name: seat.name,
    stack: seat.stack,
    bet: seat.bet,
    status: seat.status,
    cards: isHero ? hand.holeCards : seat.holeCards,
    isButton: seat.seat === hand.button,
    isHero,
    toAct: false,
    position: isHero ? hand.position : seat.seat === hand.button ? "btn/sb" : "bb",
  };
}

export function HandReplayPage() {
  const { id = "" } = useParams();
  const hasKey = getApiKey() !== null;
  const { data, error, loading, reload } = useApi((signal) => api.getHand(id, signal), [id], {
    enabled: hasKey,
  });

  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  useEffect(() => {
    setCursor(-1);
    setPlaying(false);
  }, [id]);

  const total = data?.actions.length ?? 0;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (cursorRef.current >= total - 1) {
        setPlaying(false);
        return;
      }
      setCursor(cursorRef.current + 1);
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, total]);

  const state = useMemo(() => (data ? replay(data, cursor) : null), [data, cursor]);

  const streetStarts = useMemo(() => {
    const map = new Map<Street, number>();
    data?.actions.forEach((record, index) => {
      if (!map.has(record.street)) map.set(record.street, index);
    });
    return map;
  }, [data]);

  if (!hasKey) {
    return (
      <div className="main">
        <header className="top">
          <Link to="/hands" className="btn btn-sec">
            <IconChevronLeft className="icn14" />
            一覧
          </Link>
          <h1>ハンドリプレイヤー</h1>
        </header>
        <EmptyState
          title="API キーが必要です"
          description="ハンド詳細は自分の bot の分だけ取得できる"
          action={
            <Link to="/bots" className="btn btn-pri">
              マイbot でサインアップ
            </Link>
          }
        />
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="main">
        <header className="top">
          <Link to="/hands" className="btn btn-sec">
            <IconChevronLeft className="icn14" />
            一覧
          </Link>
          <h1>ハンドリプレイヤー</h1>
        </header>
        <LoadingState label="ハンドを読み込み中" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="main">
        <header className="top">
          <Link to="/hands" className="btn btn-sec">
            <IconChevronLeft className="icn14" />
            一覧
          </Link>
          <h1>ハンドリプレイヤー</h1>
        </header>
        <ErrorState error={error} onRetry={reload} title="ハンドを取得できませんでした" />
      </div>
    );
  }

  if (!data || !state) return null;

  const sorted = [...state.seats].sort((a, b) => a.seat - b.seat);
  const heroSeat = sorted.find((s) => s.seat === data.seat) ?? sorted[0] ?? null;
  const otherSeat = sorted.find((s) => s.seat !== heroSeat?.seat) ?? null;

  const seatName = (seat: number): string =>
    data.seats.find((s) => s.seat === seat)?.botName ?? `seat ${seat}`;

  return (
    <>
      <div className="main">
        <header className="top">
          <Link to="/hands" className="btn btn-sec">
            <IconChevronLeft className="icn14" />
            一覧
          </Link>
          <h1>ハンドリプレイヤー</h1>
          <span className="bdg bdg-outline">
            <span className="mono id-badge">{data.handId}</span>
          </span>
          <span className={data.net >= 0 ? "bdg bdg-success mono" : "bdg bdg-destructive mono"}>
            {signedBb(data.net)} bb
          </span>
          <div className="spacer" />
          <span className="meta">
            <span className="mono">{seatName(data.seat)}</span> 視点 · {data.position.toUpperCase()} ·{" "}
            <span className="mono">{dateTime(data.playedAt)}</span> · レーキ{" "}
            <span className="mono">{bbLabel(data.rake, 2)}</span>
          </span>
        </header>

        <div className="stage-wrap">
          <PokerTable
            top={otherSeat ? toDisplay(otherSeat, data) : null}
            bottom={heroSeat ? toDisplay(heroSeat, data) : null}
            board={state.board}
            pot={state.pot}
          />
        </div>

        <div className="replay-bar">
          <div className="pillbar" role="group" aria-label="ストリート">
            {STREET_ORDER.map((street) => {
              const start = streetStarts.get(street);
              const active = state.street === street && cursor >= 0;
              return (
                <button
                  key={street}
                  type="button"
                  className={active ? "pill on" : "pill"}
                  disabled={start === undefined}
                  onClick={() => start !== undefined && setCursor(start)}
                >
                  {streetLabel(street)}
                </button>
              );
            })}
          </div>

          <div className="spacer" />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="ibtn"
              aria-label="最初へ"
              disabled={cursor < 0}
              onClick={() => setCursor(-1)}
            >
              <IconSkipBack className="icn14" />
            </button>
            <button
              type="button"
              className="ibtn"
              aria-label="1手戻る"
              disabled={cursor < 0}
              onClick={() => setCursor((c) => Math.max(-1, c - 1))}
            >
              <IconChevronLeft className="icn14" />
            </button>
            <button
              type="button"
              className="ibtn pri"
              aria-label={playing ? "停止" : "再生"}
              disabled={total === 0}
              onClick={() => {
                if (cursor >= total - 1) setCursor(-1);
                setPlaying((p) => !p);
              }}
            >
              {playing ? <IconPause className="icn14" /> : <IconPlay className="icn14" />}
            </button>
            <button
              type="button"
              className="ibtn"
              aria-label="1手進む"
              disabled={cursor >= total - 1}
              onClick={() => setCursor((c) => Math.min(total - 1, c + 1))}
            >
              <IconChevronRight className="icn14" />
            </button>
            <button
              type="button"
              className="ibtn"
              aria-label="最後へ"
              disabled={cursor >= total - 1}
              onClick={() => setCursor(total - 1)}
            >
              <IconSkipForward className="icn14" />
            </button>
          </div>

          <div className="spacer" />

          <span className="mono meta">
            {cursor + 1} / {total} アクション
          </span>
        </div>
      </div>

      <aside className="panel">
        <div className="panel-head">
          <span>アクション履歴</span>
          <div className="spacer" />
          <span className="meta">金額は bb</span>
        </div>
        <ActionHistory
          actions={data.actions}
          board={data.board}
          nameForSeat={seatName}
          heroSeat={data.seat}
          cursor={cursor}
          footer={
            <div className="meta" style={{ padding: "10px 12px", display: "flex", gap: 12 }}>
              <span>
                SB <span className="mono">{bbLabel(data.smallBlind)}</span>
              </span>
              <span>
                BB <span className="mono">{bbLabel(data.bigBlind)}</span>
              </span>
              <span className={signClass(data.net)}>
                収支 <span className="mono">{signedBb(data.net)}bb</span>
              </span>
            </div>
          }
        />
      </aside>
    </>
  );
}
