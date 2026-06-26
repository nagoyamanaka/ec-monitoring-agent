import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AlertsApi } from "../infrastructure/alertsApi";
import type { EvidenceApi } from "../infrastructure/evidenceApi";
import type { RemediationApi } from "../infrastructure/remediationApi";
import type { AlertStream } from "../infrastructure/AlertStream";
import { useAlerts, type UseAlertsResult } from "./hooks/useAlerts";

/**
 * 一覧 state ＋ 各 API を画面間で共有するコンテキスト値。
 * SSE ストリームと一覧 state を `<Routes>` の上で1度だけ生成・購読し、
 * ルート遷移（一覧 ⇄ 詳細）で EventSource が張り直されない／全件再取得が走らないようにする。
 */
export interface AlertsData extends UseAlertsResult {
  readonly api: AlertsApi;
  readonly evidenceApi: EvidenceApi;
  readonly remediationApi: RemediationApi;
}

const AlertsDataContext = createContext<AlertsData | null>(null);

export interface AlertsDataProviderProps {
  api: AlertsApi;
  evidenceApi: EvidenceApi;
  remediationApi: RemediationApi;
  /** アプリ存続期間ずっと生きる単一の SSE ストリーム（composition root で生成）。 */
  stream: AlertStream;
  children: ReactNode;
}

/**
 * アプリシェル（Router 直下）に置くプロバイダ。
 * ここで `useAlerts(api, stream)` を**1回だけ**走らせる＝SSE 接続はセッション通じて1本。
 * 各ページは `useAlertsData()` で同じ live な一覧を読むため、詳細ページは再 fetch せず即表示でき、
 * 画面遷移で接続ランプが点滅しない（step4-1 §10 の broadcast 一本化と整合）。
 */
export function AlertsDataProvider({
  api,
  evidenceApi,
  remediationApi,
  stream,
  children,
}: AlertsDataProviderProps) {
  const data = useAlerts(api, stream);
  const value = useMemo<AlertsData>(
    () => ({ ...data, api, evidenceApi, remediationApi }),
    [data, api, evidenceApi, remediationApi],
  );
  return (
    <AlertsDataContext.Provider value={value}>
      {children}
    </AlertsDataContext.Provider>
  );
}

/** 共有された一覧 state ＋ API を読む。プロバイダ外で呼ぶと例外（配線ミスを早期検出）。 */
export function useAlertsData(): AlertsData {
  const value = useContext(AlertsDataContext);
  if (!value) {
    throw new Error("useAlertsData must be used within <AlertsDataProvider>");
  }
  return value;
}
