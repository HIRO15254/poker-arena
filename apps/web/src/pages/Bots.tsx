/**
 * マイbot。API キーが無ければサインアップ導線を出し、キーを localStorage に保存する。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BotDetail, BotKind, CreateBotRequest } from "@poker-arena/protocol";
import { api, errorMessage, getApiKey, setApiKey, setOwnerName } from "../api";
import { useApi } from "../hooks";
import { EmptyState, ErrorState, InlineError, LoadingState } from "../components/States";
import { StatusBadge } from "./Leaderboard";
import {
  IconAlert,
  IconCheck,
  IconCopy,
  IconKey,
  IconLogout,
  IconPlus,
  IconPower,
  IconTrash,
  IconUpload,
} from "../components/Icons";
import {
  dateOnly,
  initials,
  integer,
  signClass,
  signedBb,
  signedNumber,
} from "../format";
import { BUILTIN_IDS as BUILTIN_STRATEGIES } from "../builtins";



// ---------- サインアップ ----------

function Onboarding({ onReady }: { onReady: () => void }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const signup = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.signup(name.trim());
      setApiKey(res.apiKey);
      setOwnerName(res.name);
      onReady();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const useExisting = async () => {
    setBusy(true);
    setError(null);
    const previous = getApiKey();
    try {
      setApiKey(key.trim());
      const me = await api.me();
      setOwnerName(me.name);
      onReady();
    } catch (err) {
      setApiKey(previous);
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="main">
      <header className="top">
        <h1>マイbot</h1>
      </header>
      <div className="center-page">
        <div className="onboard">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ fontSize: 17 }}>アカウントを作る</h2>
            <span className="meta">
              表示名だけで登録できる。発行された API キーはこのブラウザに保存される。
            </span>
          </div>

          <div className="crd" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="signup-name">
                表示名
              </label>
              <input
                id="signup-name"
                className="inp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="hi089697"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="btn btn-pri"
              disabled={busy || name.trim().length === 0}
              onClick={() => void signup()}
            >
              <IconKey className="icn14" />
              {busy ? "作成中" : "サインアップ"}
            </button>
          </div>

          <div className="crd" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="existing-key">
                すでに API キーがある場合
              </label>
              <input
                id="existing-key"
                className="inp mono"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="pa_live_..."
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="btn btn-sec"
              disabled={busy || key.trim().length === 0}
              onClick={() => void useExisting()}
            >
              このキーを使う
            </button>
          </div>

          {error !== null && <InlineError error={error} />}

          <div className="notice">
            API キーは Authorization ヘッダに載せて送られる。共有端末では使い終わったらサインアウトすること。
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- bot 作成フォーム ----------

function CreateBotForm({
  onCreated,
  onCancel,
}: {
  onCreated: (bot: BotDetail) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const season = useApi((signal) => api.season(signal), []);
  const webhookAllowed = season.data?.webhookBotsEnabled ?? false;
  const [kind, setKind] = useState<BotKind>("builtin");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [strategy, setStrategy] = useState(BUILTIN_STRATEGIES[0] ?? "fold");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const body: CreateBotRequest =
      kind === "webhook"
        ? { name: name.trim(), kind, webhookUrl: webhookUrl.trim() }
        : { name: name.trim(), kind, builtinStrategy: strategy };
    try {
      onCreated(await api.createBot(body));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const valid =
    name.trim().length > 0 && (kind === "builtin" || webhookUrl.trim().length > 0);

  return (
    <div className="main">
      <header className="top">
        <h1>新しい bot</h1>
        <div className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          キャンセル
        </button>
      </header>
      <div className="scroll">
        <div className="page" style={{ maxWidth: 560 }}>
          <div className="crd" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="bot-name">
                bot 名
              </label>
              <input
                id="bot-name"
                className="inp mono"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="river-raptor"
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="bot-kind">
                種別
              </label>
              <select
                id="bot-kind"
                className="inp"
                value={kind}
                onChange={(e) => setKind(e.target.value as BotKind)}
              >
                <option value="builtin">builtin — 組み込み戦略で動かす</option>
                <option value="webhook" disabled={!webhookAllowed}>
                  webhook — 自前のサーバーが応答する{webhookAllowed ? "" : "(現在停止中)"}
                </option>
              </select>
            </div>

            {!webhookAllowed ? (
              <div className="notice">
                <IconAlert className="icn14" />
                <span>
                  webhook 型 bot は現在受け付けていない。アリーナは外部への通信を行わないため、
                  対戦できるのは組み込み戦略の bot のみ。
                </span>
              </div>
            ) : null}

            {kind === "webhook" ? (
              <div className="field">
                <label className="label" htmlFor="bot-url">
                  webhook URL
                </label>
                <input
                  id="bot-url"
                  className="inp mono"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://example.com/act"
                  autoComplete="off"
                />
              </div>
            ) : (
              <div className="field">
                <label className="label" htmlFor="bot-strategy">
                  組み込み戦略
                </label>
                <select
                  id="bot-strategy"
                  className="inp mono"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                >
                  {BUILTIN_STRATEGIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error !== null && <InlineError error={error} />}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-pri"
                disabled={busy || !valid}
                onClick={() => void submit()}
              >
                <IconPlus className="icn14" />
                {busy ? "登録中" : "登録する"}
              </button>
            </div>
          </div>

          <div className="notice">
            webhook 型はアリーナから <span className="mono">POST</span> が届く。応答は 5 秒以内、
            <span className="mono">X-Arena-Signature</span> で HMAC-SHA256 を検証すること。
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- bb/100 推移 ----------

function Timeline({ points }: { points: { hands: number; bb100: number }[] }) {
  if (points.length < 2) {
    return <span className="meta">推移を描くにはデータが足りません</span>;
  }

  const width = 640;
  const height = 130;
  const padTop = 10;
  const padBottom = 16;

  const xs = points.map((p) => p.hands);
  const ys = points.map((p) => p.bb100);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const toX = (v: number) => ((v - minX) / rangeX) * width;
  const toY = (v: number) => padTop + (1 - (v - minY) / rangeY) * (height - padTop - padBottom);

  const polyline = points.map((p) => `${toX(p.hands).toFixed(1)},${toY(p.bb100).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const zeroY = toY(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height, display: "block" }} role="img" aria-label="bb/100 の推移">
      <line x1="0" y1={padTop} x2={width} y2={padTop} stroke="#26282d" strokeWidth="1" />
      <line
        x1="0"
        y1={zeroY}
        x2={width}
        y2={zeroY}
        stroke="#26282d"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <text x="4" y={zeroY - 4} fontSize="10" fill="#8a8f98" fontFamily="JetBrains Mono, monospace">
        0
      </text>
      <polyline
        points={polyline}
        fill="none"
        stroke="#4593f8"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && <circle cx={toX(last.hands)} cy={toY(last.bb100)} r="3" fill="#4593f8" />}
    </svg>
  );
}

// ---------- bot 詳細 ----------

function BotDetailPane({
  bot,
  accountKey,
  onChanged,
  onDeleted,
}: {
  bot: BotDetail;
  accountKey: string | null;
  onChanged: (bot: BotDetail) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState(bot.webhookUrl ?? "");
  const [deployStrategy, setDeployStrategy] = useState(bot.builtinStrategy ?? "tight");
  const [deployNote, setDeployNote] = useState("");

  // サーバーは自分の bot にだけ webhook 署名用の secret を返す(protocol の型には未定義)。
  const botSecret = (bot as BotDetail & { secret?: string }).secret ?? null;

  const run = async (fn: () => Promise<BotDetail>) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await fn());
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteBot(bot.id);
      onDeleted();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    if (!accountKey) return;
    try {
      await navigator.clipboard.writeText(accountKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="main">
      <header className="top">
        <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
          {bot.name}
        </span>
        <StatusBadge status={bot.status} />
        <div className="spacer" />
        <button type="button" className="btn btn-sec" onClick={() => setShowKey((v) => !v)}>
          <IconKey className="icn14" />
          APIキー
        </button>
        {bot.status === "active" ? (
          <button
            type="button"
            className="btn btn-sec"
            disabled={busy}
            onClick={() => void run(() => api.deactivateBot(bot.id))}
          >
            <IconPower className="icn14" />
            稼働停止
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-pri"
            disabled={busy}
            onClick={() => void run(() => api.activateBot(bot.id))}
          >
            <IconPower className="icn14" />
            稼働開始
          </button>
        )}
        <button
          type="button"
          className="btn btn-sec"
          disabled={busy}
          onClick={() => setDeploying((v) => !v)}
        >
          <IconUpload className="icn14" />
          新バージョンをデプロイ
        </button>
      </header>

      <div className="subbar">
        <span>{bot.kind === "webhook" ? "webhook 型" : "builtin 型"}</span>
        <span>·</span>
        <span className="mono">v{bot.version}</span>
        <span>·</span>
        <span>
          登録 <span className="mono">{dateOnly(bot.createdAt)}</span>
        </span>
        <span>·</span>
        <span>
          最終更新 <span className="mono">{dateOnly(bot.updatedAt)}</span>
        </span>
      </div>

      <div className="scroll">
        <div className="page">
          {error !== null && <InlineError error={error} />}

          {bot.lastError && (
            <div className="inline-error">
              <span>
                {bot.lastError.message} (<span className="mono">{dateOnly(bot.lastError.at)}</span>)
              </span>
            </div>
          )}

          {showKey && (
            <div className="crd" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="crd-title">アカウント API キー</span>
              <div className="key-box">
                <span style={{ flex: 1 }}>{accountKey ?? "未設定"}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => void copyKey()}
                  disabled={!accountKey}
                >
                  {copied ? <IconCheck className="icn14" /> : <IconCopy className="icn14" />}
                  {copied ? "コピー済み" : "コピー"}
                </button>
              </div>
              <span className="meta">
                すべての bot 操作はこのキーで認証する。共有端末では使い終わったらサインアウトすること。
              </span>
            </div>
          )}

          {deploying && (
            <div className="crd" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="crd-title">新バージョンをデプロイ</span>
              <div className="notice">デプロイするとシーズン成績はリセットされる。</div>
              {bot.kind === "webhook" ? (
                <div className="field">
                  <label className="label" htmlFor="deploy-url">
                    webhook URL
                  </label>
                  <input
                    id="deploy-url"
                    className="inp mono"
                    value={deployUrl}
                    onChange={(e) => setDeployUrl(e.target.value)}
                  />
                </div>
              ) : (
                <div className="field">
                  <label className="label" htmlFor="deploy-strategy">
                    組み込み戦略
                  </label>
                  <select
                    id="deploy-strategy"
                    className="inp mono"
                    value={deployStrategy}
                    onChange={(e) => setDeployStrategy(e.target.value)}
                  >
                    {BUILTIN_STRATEGIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label className="label" htmlFor="deploy-note">
                  メモ(任意)
                </label>
                <input
                  id="deploy-note"
                  className="inp"
                  value={deployNote}
                  onChange={(e) => setDeployNote(e.target.value)}
                  placeholder="3bet レンジを調整"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-pri"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const detail = await api.deployVersion(bot.id, {
                        ...(bot.kind === "webhook"
                          ? { webhookUrl: deployUrl.trim() }
                          : { builtinStrategy: deployStrategy }),
                        ...(deployNote.trim().length > 0 ? { note: deployNote.trim() } : {}),
                      });
                      setDeploying(false);
                      setDeployNote("");
                      return detail;
                    })
                  }
                >
                  <IconUpload className="icn14" />
                  デプロイ
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setDeploying(false)}>
                  キャンセル
                </button>
              </div>
            </div>
          )}

          <div className="grid3">
            <div className="crd stat">
              <span className="meta">bb/100</span>
              <span className={`stat-value ${signClass(bot.bb100)}`}>{signedNumber(bot.bb100)}</span>
              <span className="meta mono">
                95% CI {bot.ci95 === null ? "—" : `±${bot.ci95.toFixed(1)}`}
              </span>
            </div>
            <div className="crd stat">
              <span className="meta">ハンド数</span>
              <span className="stat-value">{integer(bot.hands)}</span>
              <span className="meta">
                <span className="mono">v{bot.version}</span> のみ
              </span>
            </div>
            <div className="crd stat">
              <span className="meta">収支</span>
              <span className={`stat-value ${signClass(bot.netChips)}`}>
                {signedBb(bot.netChips)}
              </span>
              <span className="meta">bb (レーキ控除後)</span>
            </div>
          </div>

          <div className="crd">
            <div className="crd-head">
              <span className="crd-title">接続設定</span>
            </div>
            <div className="crd-body">
              {bot.kind === "webhook" ? (
                <div className="key-box">
                  <span style={{ flex: 1 }}>{bot.webhookUrl ?? "未設定"}</span>
                </div>
              ) : (
                <div className="key-box">
                  <span style={{ flex: 1 }}>builtin: {bot.builtinStrategy ?? "未設定"}</span>
                </div>
              )}
              {botSecret !== null && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="label">webhook 署名シークレット</span>
                  <div className="key-box">
                    <span style={{ flex: 1 }}>{showSecret ? botSecret : "•".repeat(28)}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setShowSecret((v) => !v)}
                    >
                      {showSecret ? "隠す" : "表示"}
                    </button>
                  </div>
                  <span className="meta">
                    <span className="mono">X-Arena-Signature</span> の HMAC-SHA256 検証に使う。
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="crd">
            <div className="crd-head">
              <span className="crd-title">bb/100 推移</span>
              <div className="spacer" />
              <span className="meta">累計</span>
            </div>
            <div className="crd-body">
              {bot.stats && bot.stats.timeline.length > 0 ? (
                <Timeline points={bot.stats.timeline} />
              ) : (
                <span className="meta">推移データがありません</span>
              )}
            </div>
          </div>

          {bot.stats && (
            <div className="crd">
              <div className="crd-head">
                <span className="crd-title">スタッツ</span>
              </div>
              <div className="crd-body">
                <div className="form-grid">
                  {(
                    [
                      ["VPIP", bot.stats.vpip],
                      ["PFR", bot.stats.pfr],
                      ["WTSD", bot.stats.wtsd],
                      ["W$SD", bot.stats.wonAtShowdown],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span className="meta">{label}</span>
                      <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
                        {value.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="form-grid">
                  {Object.entries(bot.stats.byPosition).map(([position, stat]) => (
                    <div key={position} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span className="meta caps">{position.toUpperCase()}</span>
                      <span className={`mono ${signClass(stat.bb100)}`} style={{ fontSize: 15, fontWeight: 600 }}>
                        {signedNumber(stat.bb100)}
                      </span>
                      <span className="meta mono">{integer(stat.hands)} ハンド</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="crd">
            <div className="crd-head">
              <span className="crd-title">バージョン履歴</span>
            </div>
            {bot.versions.length === 0 ? (
              <div className="crd-body">
                <span className="meta">履歴がありません</span>
              </div>
            ) : (
              bot.versions.map((version) => (
                <div className="vrow" key={version.version}>
                  <span className="mono" style={{ fontWeight: 500, width: 36 }}>
                    v{version.version}
                  </span>
                  {version.version === bot.version ? (
                    <StatusBadge status={bot.status} />
                  ) : (
                    <span className="bdg bdg-neutral">
                      <span className="dt" />
                      停止
                    </span>
                  )}
                  <span className="muted">
                    デプロイ <span className="mono">{dateOnly(version.deployedAt)}</span>
                  </span>
                  {version.note && <span className="meta truncate">{version.note}</span>}
                  <div className="spacer" />
                  <span className="mono muted">{integer(version.hands)}ハンド</span>
                  <span
                    className={`mono ${signClass(version.bb100)}`}
                    style={{ width: 56, textAlign: "right" }}
                  >
                    {signedNumber(version.bb100)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void remove()}>
              <IconTrash className="icn14" />
              この bot を削除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- ページ ----------

export function BotsPage() {
  const [keyVersion, setKeyVersion] = useState(0);
  const hasKey = useMemo(() => getApiKey() !== null, [keyVersion]);

  const me = useApi((signal) => api.me(signal), [keyVersion], { enabled: hasKey });
  const bots = useApi((signal) => api.listBots(signal), [keyVersion], { enabled: hasKey });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!bots.data) return;
    if (bots.data.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && bots.data?.some((b) => b.id === current)) return current;
      return bots.data?.[0]?.id ?? null;
    });
  }, [bots.data]);

  const detail = useApi(
    (signal) => api.getBot(selectedId ?? "", signal),
    [selectedId],
    { enabled: hasKey && selectedId !== null },
  );

  const signOut = useCallback(() => {
    setApiKey(null);
    setOwnerName(null);
    setSelectedId(null);
    setKeyVersion((v) => v + 1);
  }, []);

  if (!hasKey) {
    return <Onboarding onReady={() => setKeyVersion((v) => v + 1)} />;
  }

  return (
    <>
      <div className="botlist">
        <header className="top">
          <h1>マイbot</h1>
          <div className="spacer" />
          <button type="button" className="btn btn-pri" onClick={() => setCreating(true)}>
            <IconPlus className="icn14" />
            新しいbot
          </button>
        </header>

        {bots.loading && !bots.data && <LoadingState label="bot を読み込み中" />}
        {bots.error !== null && !bots.data && (
          <ErrorState error={bots.error} onRetry={bots.reload} />
        )}

        {bots.data && (
          <div className="scroll">
            {bots.data.length === 0 ? (
              <EmptyState title="bot がまだありません" description="webhook か builtin で登録する" />
            ) : (
              bots.data.map((bot) => (
                <button
                  key={bot.id}
                  type="button"
                  className={bot.id === selectedId && !creating ? "botrow on" : "botrow"}
                  onClick={() => {
                    setCreating(false);
                    setSelectedId(bot.id);
                  }}
                >
                  <span className="avt">{initials(bot.name)}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span className="mono truncate" style={{ fontWeight: 500 }}>
                        {bot.name}
                      </span>
                      <span className="mono meta">v{bot.version}</span>
                    </span>
                    <span style={{ alignSelf: "flex-start" }}>
                      <StatusBadge status={bot.status} />
                    </span>
                  </span>
                  <span className={`num ${signClass(bot.bb100)}`}>
                    {bot.hands === 0 ? "—" : signedNumber(bot.bb100)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        <div className="spacer" />
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span className="meta">
            {me.data ? (
              <>
                <span className="mono">
                  {bots.data?.length ?? 0} / {me.data.botLimit}
                </span>{" "}
                bot を使用中 · <span className="mono">{me.data.name}</span>
              </>
            ) : (
              "アカウント情報を取得中"
            )}
          </span>
          <div className="spacer" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={signOut}>
            <IconLogout className="icn14" />
            サインアウト
          </button>
        </div>
      </div>

      {creating ? (
        <CreateBotForm
          onCancel={() => setCreating(false)}
          onCreated={(bot) => {
            setCreating(false);
            bots.reload();
            setSelectedId(bot.id);
          }}
        />
      ) : detail.loading && !detail.data ? (
        <div className="main">
          <LoadingState label="bot 情報を読み込み中" />
        </div>
      ) : detail.error && !detail.data ? (
        <div className="main">
          <ErrorState error={detail.error} onRetry={detail.reload} />
        </div>
      ) : detail.data ? (
        <BotDetailPane
          bot={detail.data}
          // API キーはサーバーから取得できない(ハッシュのみ保持)。発行時に保存したものを使う
          accountKey={getApiKey()}
          onChanged={(bot) => {
            detail.setData(bot);
            bots.reload();
          }}
          onDeleted={() => {
            setSelectedId(null);
            bots.reload();
          }}
        />
      ) : (
        <div className="main">
          <EmptyState
            title="bot を選ぶ"
            description={
              bots.error ? errorMessage(bots.error) : "左の一覧から選ぶか、新しい bot を登録する"
            }
            action={
              <button type="button" className="btn btn-pri" onClick={() => setCreating(true)}>
                <IconPlus className="icn14" />
                新しいbot
              </button>
            }
          />
        </div>
      )}
    </>
  );
}
