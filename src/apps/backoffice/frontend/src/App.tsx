import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { FetchHttpClient } from "@shared/api/FetchHttpClient";
import { createAlertsApi } from "@features/alerts/infrastructure/alertsApi";
import { createEvidenceApi } from "@features/alerts/infrastructure/evidenceApi";
import { createRemediationApi } from "@features/alerts/infrastructure/remediationApi";
import { SSEAlertStream } from "@features/alerts/infrastructure/SSEAlertStream";
import { AlertsDataProvider } from "@features/alerts/presentation/AlertsDataProvider";
import { AlertsPage } from "@features/alerts/presentation/pages/AlertsPage";
import { AlertDetailPage } from "@features/alerts/presentation/pages/AlertDetailPage";
import { createDemoApi } from "@features/demo/infrastructure/demoApi";
import { createAnalyticsApi } from "@features/analytics/infrastructure/analyticsApi";
import { AnalyticsPage } from "@features/analytics/presentation/pages/AnalyticsPage";

/**
 * バックオフィスの composition root。
 * HttpClient・各 API・SSE ストリームをここで**1度だけ**生成し、`AlertsDataProvider` で
 * 一覧 state と SSE 接続をアプリ全体に共有する（ルート遷移で接続が切れない／全件再取得しない）。
 * 各ページが自前のレイアウトを持つためルーティングはフラット構成。
 */
export function App() {
  const http = useMemo(() => new FetchHttpClient(), []);
  const api = useMemo(() => createAlertsApi(http), [http]);
  const evidenceApi = useMemo(() => createEvidenceApi(http), [http]);
  const remediationApi = useMemo(() => createRemediationApi(http), [http]);
  const demoApi = useMemo(() => createDemoApi(http), [http]);
  const analyticsApi = useMemo(() => createAnalyticsApi(http), [http]);
  const stream = useMemo(() => new SSEAlertStream(), []);

  return (
    <AlertsDataProvider
      api={api}
      evidenceApi={evidenceApi}
      remediationApi={remediationApi}
      stream={stream}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/alerts" replace />} />
        <Route path="/alerts" element={<AlertsPage demoApi={demoApi} />} />
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
        <Route
          path="/analytics"
          element={<AnalyticsPage api={analyticsApi} />}
        />
        <Route path="*" element={<Navigate to="/alerts" replace />} />
      </Routes>
    </AlertsDataProvider>
  );
}
