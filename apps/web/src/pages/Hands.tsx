/** ハンド履歴。GET /api/hands は botId 必須なので、自分の bot を選んでから引く。 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getApiKey } from "../api";
import { useApi } from "../hooks";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { IconSearch } from "../components/Icons";
import { bbLabel, dateTime, signClass, signedBb } from "../format";

export function HandsPage() {
  const navigate = useNavigate();
  const hasKey = getApiKey() !== null;
  const [handId, setHandId] = useState("");
  const [botId, setBotId] = useState<string | null>(null);

  const bots = useApi((signal) => api.listBots(signal), [], { enabled: hasKey });

  useEffect(() => {
    if (!bots.data || bots.data.length === 0) return;
    setBotId((current) => {
      if (current && bots.data?.some((b) => b.id === current)) return current;
      return bots.data?.[0]?.id ?? null;
    });
  }, [bots.data]);

  const hands = useApi(
    (signal) => api.listHands({ botId: botId ?? undefined, limit: 50 }, signal),
    [botId],
    { enabled: hasKey && botId !== null },
  );

  return (
    <div className="main">
      <header className="top">
        <h1>ハンドリプレイヤー</h1>
        {hasKey && bots.data && bots.data.length > 0 && (
          <select
            className="inp mono"
            style={{ width: 200 }}
            value={botId ?? ""}
            aria-label="bot を選ぶ"
            onChange={(e) => setBotId(e.target.value)}
          >
            {bots.data.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
        )}
        <div className="spacer" />
        <form
          style={{ display: "flex", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            const id = handId.trim();
            if (id.length > 0) navigate(`/hands/${encodeURIComponent(id)}`);
          }}
        >
          <div className="inp-wrap" style={{ width: 240 }}>
            <IconSearch className="icn14" />
            <input
              value={handId}
              onChange={(e) => setHandId(e.target.value)}
              placeholder="ハンドIDを入力"
              aria-label="ハンドIDを入力"
              className="mono"
            />
          </div>
          <button type="submit" className="btn btn-sec" disabled={handId.trim().length === 0}>
            開く
          </button>
        </form>
      </header>

      {!hasKey && (
        <EmptyState
          title="API キーが必要です"
          description="ハンド履歴は自分の bot の分だけ取得できる"
          action={
            <Link to="/bots" className="btn btn-pri">
              マイbot でサインアップ
            </Link>
          }
        />
      )}

      {hasKey && bots.loading && !bots.data && <LoadingState label="bot を読み込み中" />}
      {hasKey && bots.error !== null && !bots.data && (
        <ErrorState error={bots.error} onRetry={bots.reload} />
      )}

      {hasKey && bots.data && bots.data.length === 0 && (
        <EmptyState
          title="bot がまだありません"
          description="bot を登録して稼働させるとハンド履歴が溜まる"
          action={
            <Link to="/bots" className="btn btn-pri">
              マイbot へ
            </Link>
          }
        />
      )}

      {hasKey && botId !== null && (
        <>
          {hands.loading && !hands.data && <LoadingState label="ハンド履歴を読み込み中" />}
          {hands.error !== null && !hands.data && (
            <ErrorState error={hands.error} onRetry={hands.reload} />
          )}

          {hands.data && (
            <>
              <div className="hand-row head">
                <span className="th">ハンドID</span>
                <span className="th">日時</span>
                <span className="th">ボード</span>
                <span className="th right">ポット</span>
                <span className="th">SD</span>
                <span className="th right">収支</span>
              </div>
              <div className="scroll">
                {hands.data.hands.length === 0 ? (
                  <EmptyState
                    title="ハンド履歴がありません"
                    description="bot を稼働させるとここに溜まる"
                  />
                ) : (
                  hands.data.hands.map((hand) => (
                    <button
                      key={hand.handId}
                      type="button"
                      className="hand-row clickable"
                      onClick={() => navigate(`/hands/${encodeURIComponent(hand.handId)}`)}
                    >
                      <span className="mono truncate" style={{ fontWeight: 500 }}>
                        {hand.handId}
                      </span>
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        {dateTime(hand.playedAt)}
                      </span>
                      <span className="mono truncate">{hand.board.join(" ") || "—"}</span>
                      <span className="num right muted">{bbLabel(hand.potSize)}</span>
                      <span className="meta">{hand.wentToShowdown ? "あり" : "—"}</span>
                      <span className={`num right ${signClass(hand.net)}`}>
                        {signedBb(hand.net)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
