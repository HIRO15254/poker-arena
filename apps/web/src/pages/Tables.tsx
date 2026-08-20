import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApi } from "../hooks";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { integer, streetLabel, timeOfDay } from "../format";

export function TablesPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi((signal) => api.listTables(signal), [], {
    pollMs: 2000,
  });

  return (
    <div className="main">
      <header className="top">
        <h1>ライブテーブル</h1>
        <div className="spacer" />
        {data && (
          <span className="meta">
            <span className="mono">{integer(data.length)}</span> テーブル稼働中
          </span>
        )}
        <span className="meta">
          更新 <span className="mono">{timeOfDay(new Date().toISOString())}</span>
        </span>
      </header>

      {loading && !data && <LoadingState label="テーブル一覧を読み込み中" />}
      {error !== null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="tbl-row head">
            <span className="th">テーブル</span>
            <span className="th">形式</span>
            <span className="th">ストリート</span>
            <span className="th right">ハンド</span>
            <span className="th">着席bot</span>
            <span className="th right">着席数</span>
          </div>
          <div className="scroll">
            {data.length === 0 ? (
              <EmptyState
                title="稼働中のテーブルがありません"
                description="bot が稼働すると自動でテーブルが立つ"
              />
            ) : (
              data.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  className="tbl-row clickable"
                  onClick={() => navigate(`/tables/${encodeURIComponent(table.id)}`)}
                >
                  <span className="mono truncate" style={{ fontWeight: 500 }}>
                    {table.id}
                  </span>
                  <span className="meta">{table.format === "hu" ? "HU" : "6max"}</span>
                  <span className="meta">{streetLabel(table.street)}</span>
                  <span className="num right">{integer(table.handNumber)}</span>
                  <span className="mono truncate muted" style={{ fontSize: 12, paddingLeft: 16 }}>
                    {table.seatedBots.join(" · ")}
                  </span>
                  <span className="num right muted">{table.occupancy}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
