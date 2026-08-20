import { useCallback, useEffect, useRef, useState } from "react";
import type { DependencyList } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

export interface UseApiResult<T> extends AsyncState<T> {
  reload: () => void;
  setData: (data: T) => void;
}

interface UseApiOptions {
  /** ポーリング間隔 (ms)。指定時はバックグラウンドで静かに再取得する。 */
  pollMs?: number;
  /** false なら取得しない(例: API キー未設定) */
  enabled?: boolean;
}

/**
 * 取得 + 再取得 + 任意のポーリングをまとめた最小のデータ取得フック。
 * 失敗時は必ず error を露出する(モックデータへのフォールバックはしない)。
 */
export function useApi<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: UseApiOptions = {},
): UseApiResult<T> {
  const { pollMs, enabled = true } = options;
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: enabled,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    let timer: number | undefined;

    const run = async (silent: boolean) => {
      if (!silent) setState((prev) => ({ ...prev, loading: true }));
      try {
        const data = await loaderRef.current(controller.signal);
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState((prev) => ({ data: silent ? prev.data : null, error: err, loading: false }));
      }
    };

    void run(false);
    if (pollMs !== undefined) {
      timer = window.setInterval(() => {
        void run(true);
      }, pollMs);
    }

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled, pollMs]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setState({ data, error: null, loading: false }), []);

  return { ...state, reload, setData };
}
