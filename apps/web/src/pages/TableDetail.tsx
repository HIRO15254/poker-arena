/** 観戦用のテーブル表示。ホールカードは非公開。2秒ポーリング(WebSocket は使わない)。 */

import { Link, useParams } from "react-router-dom";
import type { TableSeatView } from "@poker-arena/protocol";
import { api } from "../api";
import { useApi } from "../hooks";
import { PokerTable } from "../components/PokerTable";
import type { TableSeatDisplay } from "../components/PokerTable";
import { ActionHistory } from "../components/ActionHistory";
import { ErrorState, LoadingState } from "../components/States";
import { IconChevronLeft, IconUsers } from "../components/Icons";
import { integer, timeOfDay } from "../format";

function toDisplay(seat: TableSeatView, format: string): TableSeatDisplay {
  return {
    seat: seat.seat,
    name: seat.botName,
    stack: seat.stack,
    bet: seat.bet,
    status: seat.status === "empty" ? "folded" : seat.status,
    cards: seat.cards && seat.cards.length > 0 ? seat.cards : null,
    isButton: seat.isButton,
    isHero: false,
    toAct: seat.toAct,
    position: format === "hu" ? (seat.isButton ? "btn/sb" : "bb") : undefined,
  };
}

export function TableDetailPage() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useApi(
    (signal) => api.getTable(id, signal),
    [id],
    { pollMs: 2000 },
  );

  if (loading && !data) {
    return (
      <div className="main">
        <header className="top">
          <Link to="/tables" className="btn btn-sec">
            <IconChevronLeft className="icn14" />
            一覧
          </Link>
          <h1>ライブテーブル</h1>
        </header>
        <LoadingState label="テーブルを読み込み中" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="main">
        <header className="top">
          <Link to="/tables" className="btn btn-sec">
            <IconChevronLeft className="icn14" />
            一覧
          </Link>
          <h1>ライブテーブル</h1>
        </header>
        <ErrorState error={error} onRetry={reload} title="テーブルを取得できませんでした" />
      </div>
    );
  }

  if (!data) return null;

  const seated = data.seats.filter((s) => s.status !== "empty");
  const sorted = [...seated].sort((a, b) => a.seat - b.seat);
  const bottom = sorted[0] ? toDisplay(sorted[0], data.format) : null;
  const top = sorted[1] ? toDisplay(sorted[1], data.format) : null;

  const seatName = (seat: number): string =>
    data.seats.find((s) => s.seat === seat)?.botName ?? `seat ${seat}`;

  return (
    <>
      <div className="main">
        <header className="top">
          <Link to="/tables" className="btn btn-sec">
            <IconChevronLeft className="icn14" />
            一覧
          </Link>
          <h1>ライブテーブル</h1>
          <span className="bdg bdg-outline">
            <span className="mono id-badge">{data.id}</span>
          </span>
          <span className="meta">
            ハンド <span className="mono">{integer(data.handNumber)}</span>
          </span>
          <div className="spacer" />
          <span className="meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconUsers className="icn14" />
            観戦 <span className="mono">{integer(data.spectators)}</span>
          </span>
          <span className="bdg bdg-outline">
            <span className="mono id-badge">{data.handId}</span>
          </span>
          <span className="meta">
            更新 <span className="mono">{timeOfDay(data.updatedAt)}</span>
          </span>
        </header>

        <div className="stage-wrap">
          <PokerTable top={top} bottom={bottom} board={data.board} pot={data.pot} />
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
          autoScroll
          footer={
            <div className="meta" style={{ padding: "10px 12px" }}>
              ホールカードは非公開。ショーダウンの公開分のみ表示。
            </div>
          }
        />
      </aside>
    </>
  );
}
