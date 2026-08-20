import { useMemo, useState } from "react";
import type { BotStatus, LeaderboardEntry } from "@poker-arena/protocol";
import { api, getOwnerName } from "../api";
import { useApi } from "../hooks";
import { ErrorState, LoadingState, EmptyState } from "../components/States";
import { IconSearch } from "../components/Icons";
import { initials, integer, signClass, signedNumber, timeOfDay } from "../format";

export function STATUS_BADGE(status: BotStatus): { className: string; label: string } {
  switch (status) {
    case "active":
      return { className: "bdg bdg-success", label: "稼働中" };
    case "error":
      return { className: "bdg bdg-destructive", label: "エラー" };
    default:
      return { className: "bdg bdg-neutral", label: "停止中" };
  }
}

export function StatusBadge({ status }: { status: BotStatus }) {
  const { className, label } = STATUS_BADGE(status);
  return (
    <span className={className}>
      <span className="dt" />
      {label}
    </span>
  );
}

function Row({ entry, isMine }: { entry: LeaderboardEntry; isMine: boolean }) {
  return (
    <div className={isMine ? "lb-row me" : "lb-row"}>
      <span className="num muted">{entry.rank}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span className="avt">{initials(entry.name)}</span>
        <span className="mono truncate" style={{ fontWeight: 500 }}>
          {entry.name}
        </span>
        {isMine && <span className="bdg bdg-primary">自分</span>}
        {!entry.qualified && <span className="bdg bdg-outline">条件未達</span>}
      </span>
      <span className="mono truncate muted" style={{ fontSize: 12 }}>
        {entry.ownerName}
      </span>
      <span className={`num right ${signClass(entry.bb100)}`}>{signedNumber(entry.bb100)}</span>
      <span className="num right muted">{entry.ci95 === null ? "—" : `±${entry.ci95.toFixed(1)}`}</span>
      <span className="num right">{integer(entry.hands)}</span>
      <span style={{ paddingLeft: 16 }}>
        <StatusBadge status={entry.status} />
      </span>
    </div>
  );
}

export function LeaderboardPage() {
  const { data, error, loading, reload } = useApi((signal) => api.leaderboard(signal), []);
  const [query, setQuery] = useState("");
  const owner = getOwnerName();

  const entries = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (q.length === 0) return data.entries;
    return data.entries.filter(
      (e) => e.name.toLowerCase().includes(q) || e.ownerName.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="main">
      <header className="top">
        <h1>リーダーボード</h1>
        <div className="spacer" />
        <div className="inp-wrap" style={{ width: 220 }}>
          <IconSearch className="icn14" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="botを検索"
            aria-label="botを検索"
          />
        </div>
      </header>

      <div className="subbar">
        {data ? (
          <span>
            {data.season.name} · <span className="mono">{integer(data.totalBots)}</span> bot · 掲載条件{" "}
            <span className="mono">{integer(data.season.minHandsForLeaderboard)}</span>
            ハンド以上 · 直近バージョンの成績
          </span>
        ) : (
          <span>シーズン情報を取得中</span>
        )}
        <div className="spacer" />
        {data && (
          <span>
            更新 <span className="mono">{timeOfDay(data.updatedAt)}</span>
          </span>
        )}
      </div>

      {loading && !data && <LoadingState label="リーダーボードを読み込み中" />}
      {error !== null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="lb-row head">
            <span className="th">#</span>
            <span className="th">bot</span>
            <span className="th">所有者</span>
            <span className="th right">bb/100</span>
            <span className="th right">95% CI</span>
            <span className="th right">ハンド数</span>
            <span className="th" style={{ paddingLeft: 16 }}>
              状態
            </span>
          </div>
          <div className="scroll">
            {entries.length === 0 ? (
              <EmptyState
                title="該当する bot がありません"
                description={
                  query.trim().length > 0
                    ? "検索条件を変えてください"
                    : "まだ掲載条件を満たした bot がありません"
                }
              />
            ) : (
              entries.map((entry) => (
                <Row
                  key={entry.id}
                  entry={entry}
                  isMine={owner !== null && entry.ownerName === owner}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
