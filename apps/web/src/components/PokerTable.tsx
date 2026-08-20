/**
 * ヘッズアップ(2人)テーブル。シーズン1は HU なので席は2つだけ。
 * hero を下、相手を上に配置し、中央にポットとボードを置く。
 */

import { Board, CardRow } from "./Card";
import { bbLabel, bb, initials } from "../format";

export interface TableSeatDisplay {
  seat: number;
  name: string;
  /** チップ絶対値 */
  stack: number;
  /** そのストリートで出しているチップ */
  bet: number;
  status: "active" | "folded" | "allin" | "empty";
  /** null は伏せ札。空配列も伏せ札扱い。 */
  cards: string[] | null;
  isButton: boolean;
  isHero: boolean;
  toAct: boolean;
  position?: string;
}

function SeatCard({ seat, place }: { seat: TableSeatDisplay; place: "top" | "bottom" }) {
  const classes = ["seat", place === "top" ? "seat-top" : "seat-bottom"];
  if (seat.status === "folded") classes.push("fold");
  if (seat.toAct) classes.push("act");
  else if (seat.isHero) classes.push("hero");

  return (
    <div className={classes.join(" ")}>
      <span className="nm">
        <span className="avt">{initials(seat.name)}</span>
        <span className="truncate">{seat.name}</span>
        {seat.isHero && <span className="bdg bdg-primary">自分</span>}
      </span>
      <span className="st">
        <span className="stack">{bbLabel(seat.stack)}</span>
        {seat.position && <span className="pos">{seat.position.toUpperCase()}</span>}
        {seat.status === "allin" && <span className="bdg bdg-warning">オールイン</span>}
        {seat.status === "folded" && <span className="bdg bdg-neutral">フォールド</span>}
      </span>
    </div>
  );
}

export function PokerTable({
  top,
  bottom,
  board,
  pot,
  note,
}: {
  top: TableSeatDisplay | null;
  bottom: TableSeatDisplay | null;
  board: string[];
  /** チップ絶対値。API の pot は現ストリートのベットを含む総額。 */
  pot: number;
  note?: string;
}) {
  return (
    <div className="stage">
      <div className="felt">
        <svg className="felt-ghost" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5C9.5 6.5 4.5 9 4.5 13a3.8 3.8 0 0 0 6.3 2.9c-.2 1.9-.9 3.4-1.8 4.6h6c-.9-1.2-1.6-2.7-1.8-4.6a3.8 3.8 0 0 0 6.3-2.9c0-4-5-6.5-7.5-10.5z" />
        </svg>
      </div>

      {top && (
        <>
          <SeatCard seat={top} place="top" />
          {top.status !== "folded" && (
            <div className="holecards holecards-top">
              <CardRow cards={top.cards && top.cards.length > 0 ? top.cards : null} size="md" />
            </div>
          )}
          {top.isButton && <span className="dbtn dbtn-top">D</span>}
          {top.bet > 0 && <span className="betchip betchip-top">{bb(top.bet)}</span>}
        </>
      )}

      <div className="center">
        <span className="pot-line">
          ポット <span className="pot-value">{bbLabel(pot)}</span>
        </span>
        <Board cards={board} size="md" />
        {note && <span className="center-note">{note}</span>}
      </div>

      {bottom && (
        <>
          {bottom.bet > 0 && <span className="betchip betchip-bottom">{bb(bottom.bet)}</span>}
          {bottom.status !== "folded" && (
            <div className="holecards holecards-bottom">
              <CardRow
                cards={bottom.cards && bottom.cards.length > 0 ? bottom.cards : null}
                size={bottom.isHero ? "lg" : "md"}
              />
            </div>
          )}
          {bottom.isButton && <span className="dbtn dbtn-bottom">D</span>}
          <SeatCard seat={bottom} place="bottom" />
        </>
      )}
    </div>
  );
}
