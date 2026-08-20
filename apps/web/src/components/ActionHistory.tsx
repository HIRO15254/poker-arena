/**
 * アクション履歴パネル。ストリートごとにグループ化し、全件を表示する
 * (直近だけを流すティッカーにはしない)。金額はすべて bb。
 */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { ActionRecord, Street } from "@poker-arena/protocol";
import { bb, streetCards, streetLabel } from "../format";

const ACTION_LABEL: Record<string, string> = {
  post_sb: "sb",
  post_bb: "bb",
  fold: "fold",
  check: "check",
  call: "call",
  bet: "bet",
  raise: "raise",
};

function actionLabel(record: ActionRecord): string {
  if (record.all_in) return "all-in";
  return ACTION_LABEL[record.action] ?? record.action;
}

interface Group {
  street: Street;
  rows: { index: number; record: ActionRecord }[];
}

function groupByStreet(actions: ActionRecord[]): Group[] {
  const groups: Group[] = [];
  actions.forEach((record, index) => {
    const last = groups[groups.length - 1];
    if (!last || last.street !== record.street) {
      groups.push({ street: record.street, rows: [{ index, record }] });
    } else {
      last.rows.push({ index, record });
    }
  });
  return groups;
}

export function ActionHistory({
  actions,
  board,
  nameForSeat,
  heroSeat = null,
  cursor = null,
  footer,
  autoScroll = false,
  emptyLabel = "アクションはまだありません",
}: {
  actions: ActionRecord[];
  board: string[];
  nameForSeat: (seat: number) => string;
  heroSeat?: number | null;
  /** リプレイ用。このインデックスが直近に実行されたアクション。以降は未実行として薄く表示。 */
  cursor?: number | null;
  footer?: ReactNode;
  autoScroll?: boolean;
  emptyLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [autoScroll, actions.length]);

  const groups = groupByStreet(actions);

  return (
    <div className="scroll" ref={scrollRef} style={{ padding: "0 4px 8px" }}>
      {actions.length === 0 && <div className="state">{emptyLabel}</div>}
      {groups.map((group, gi) => {
        const cards = streetCards(group.street, board);
        const firstIndex = group.rows[0]?.index ?? 0;
        const dimmed = cursor !== null && firstIndex > cursor;
        return (
          <div key={`${group.street}-${gi}`}>
            <div className="shead" style={dimmed ? { opacity: 0.4 } : undefined}>
              {streetLabel(group.street)}
              {cards.length > 0 && <span className="mono">{cards.join(" ")}</span>}
            </div>
            {group.rows.map(({ index, record }) => {
              const classes = ["arow"];
              if (cursor === null) classes.push("done");
              else if (index < cursor) classes.push("done");
              else if (index === cursor) classes.push("now");
              else classes.push("next");
              if (heroSeat !== null && record.seat === heroSeat) classes.push("hero");
              return (
                <div className={classes.join(" ")} key={index}>
                  <span className="who">{nameForSeat(record.seat)}</span>
                  <span>{actionLabel(record)}</span>
                  {record.forced && <span className="bdg bdg-warning">強制</span>}
                  {record.amount !== undefined && record.amount > 0 && (
                    <span className="amt">{bb(record.amount)}</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="spacer" />
      {footer}
    </div>
  );
}
