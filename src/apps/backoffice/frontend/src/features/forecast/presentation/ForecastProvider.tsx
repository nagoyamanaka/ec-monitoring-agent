import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ForecastApi,
  ForecastSnapshot,
} from "../infrastructure/forecastApi";
import { triggerForecast } from "../application/triggerForecast";
import type { ForecastBriefingView } from "../domain/ForecastView";

/**
 * 予兆ブリーフィングの共有 state（step6 F7）。composition root（App）で1度だけ張り、
 * - ForecastPage … スナップショット表示・生成
 * - 各ページのヘッダー … ナビ表示可否（FORECAST_ENABLED off時は非表示）＋ HIGH バッジ
 * を同じ GET /forecast 1回から導く＝可用性判定の単一ソース。
 * SSE には乗せない（予報は pull・審査員閲覧はキャッシュ済み GET のみ＝F6 の方針）。
 */

type ForecastStatus = "loading" | "ready" | "error";

interface ForecastData {
  /** null＝未取得（初回ロード中/失敗）。 */
  snapshot: ForecastSnapshot | null;
  status: ForecastStatus;
  error: string | null;
  refresh(): Promise<void>;
  generating: boolean;
  /** POST /forecast。成功時は snapshot も更新する。失敗は throw（呼び出し側で文言化）。 */
  generate(): Promise<ForecastBriefingView>;
  resetting: boolean;
  /** DELETE /forecast（F12）。成功時は snapshot を empty へ。失敗は throw（呼び出し側で文言化）。 */
  reset(): Promise<void>;
}

const ForecastContext = createContext<ForecastData | null>(null);

export interface ForecastProviderProps {
  api: ForecastApi;
  children: ReactNode;
}

export function ForecastProvider({ api, children }: ForecastProviderProps) {
  const [snapshot, setSnapshot] = useState<ForecastSnapshot | null>(null);
  const [status, setStatus] = useState<ForecastStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      setSnapshot(await api.getLatest());
      setStatus("ready");
    } catch {
      setStatus("error");
      setError("予報の取得に失敗しました。時間をおいて再試行してください。");
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const briefing = await triggerForecast(api);
      setSnapshot({ kind: "ready", briefing });
      setStatus("ready");
      setError(null);
      return briefing;
    } finally {
      setGenerating(false);
    }
  }, [api]);

  const [resetting, setResetting] = useState(false);
  const reset = useCallback(async () => {
    setResetting(true);
    try {
      await api.reset();
      // GET を挟まず直接 empty へ（DELETE 成功＝未生成が確定している）。
      setSnapshot({ kind: "empty" });
      setStatus("ready");
      setError(null);
    } finally {
      setResetting(false);
    }
  }, [api]);

  const value = useMemo<ForecastData>(
    () => ({
      snapshot,
      status,
      error,
      refresh,
      generating,
      generate,
      resetting,
      reset,
    }),
    [snapshot, status, error, refresh, generating, generate, resetting, reset],
  );

  return (
    <ForecastContext.Provider value={value}>
      {children}
    </ForecastContext.Provider>
  );
}

/** ForecastPage 用。Provider 必須（composition root で必ず張られる）。 */
export function useForecastData(): ForecastData {
  const ctx = useContext(ForecastContext);
  if (!ctx) {
    throw new Error("useForecastData must be used within ForecastProvider");
  }
  return ctx;
}

/** ヘッダーナビ用の導出値。Forecast タブの表示可否と HIGH 件数バッジ（導線1個・F7 任意項目）。 */
export type ForecastNav = {
  readonly enabled: boolean;
  readonly badge?: string;
};

/**
 * Provider 外（テスト等）では disabled 扱いに degrade する＝既存ページのテストに
 * Provider の同梱を強制しない。
 */
export function useForecastNav(): ForecastNav {
  const ctx = useContext(ForecastContext);
  const snapshot = ctx?.snapshot ?? null;
  if (!snapshot || snapshot.kind === "disabled") return { enabled: false };
  const high =
    snapshot.kind === "ready" ? snapshot.briefing.highRiskCount : 0;
  return {
    enabled: true,
    badge: high > 0 ? `HIGH ${high}件` : undefined,
  };
}
