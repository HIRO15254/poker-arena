/** ローディング / エラー / 空状態。モックデータは絶対に出さない。 */

import type { ReactNode } from "react";
import { IconAlert, IconRefresh } from "./Icons";
import { errorMessage } from "../api";

export function LoadingState({ label = "読み込み中" }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 240 }}>
        <div className="skeleton" style={{ height: 10, width: "60%" }} />
        <div className="skeleton" style={{ height: 10, width: "100%" }} />
        <div className="skeleton" style={{ height: 10, width: "80%" }} />
      </div>
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "読み込みに失敗しました",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="state err" role="alert">
      <IconAlert className="icn20" />
      <span className="state-title">{title}</span>
      <span>{errorMessage(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn-sec" onClick={onRetry}>
          <IconRefresh className="icn14" />
          再試行
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <span className="state-title">{title}</span>
      {description && <span>{description}</span>}
      {action}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  return (
    <div className="inline-error" role="alert">
      <IconAlert className="icn14" />
      <span>{errorMessage(error)}</span>
    </div>
  );
}
