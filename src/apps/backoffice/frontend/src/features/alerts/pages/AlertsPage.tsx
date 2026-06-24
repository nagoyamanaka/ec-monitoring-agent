import { useCallback, useMemo, useState } from "react";
import { FetchHttpClient } from "@shared/api/FetchHttpClient";
import { AlertsLayout } from "@shared/layouts/AlertsLayout";
import { createAlertsApi } from "../infrastructure/alertsApi";
import { createEvidenceApi } from "../infrastructure/evidenceApi";
import { SSEAlertStream } from "../infrastructure/SSEAlertStream";
import { useAlerts } from "../presentation/hooks/useAlerts";
import {
  submitFeedback,
  type FeedbackDecision,
} from "../application/submitFeedback";
import { AlertList } from "../components/AlertList";
import { AlertDetailDrawer } from "../components/AlertDetailDrawer";
import { StreamStatusIndicator } from "../components/StreamStatusIndicator";

/**
 * アラート一覧ページ（デモの舞台＝AlertsLayout）。
 * api/stream は composition root としてここで生成し、useMemo で安定参照にする
 * （毎レンダー再生成すると useAlerts/useAlertStream が再購読してしまうため）。
 * 一覧（マスター）＋ 行クリックで右オーバーレイ詳細ドロワー（detail）の master-detail。
 * 選択中 alert は alerts から都度引く＝SSE 更新がドロワーにもライブ反映される。
 */
export function AlertsPage() {
  const http = useMemo(() => new FetchHttpClient(), []);
  const api = useMemo(() => createAlertsApi(http), [http]);
  const evidenceApi = useMemo(() => createEvidenceApi(http), [http]);
  const stream = useMemo(() => new SSEAlertStream(), []);
  const {
    alerts,
    status,
    error,
    streamStatus,
    lastUpdatedAt,
    refreshAlert,
    reconnectStream,
  } = useAlerts(api, stream);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => alerts.find((a) => a.id === selectedId) ?? null,
    [alerts, selectedId],
  );

  const handleDecision = useCallback(
    async (alertId: string, decision: FeedbackDecision) => {
      try {
        await submitFeedback(api, { alertId, decision });
        // PATCH は ok のみ返し SSE push も無いため、自前で再取得して reviewStatus を反映する
        await refreshAlert(alertId);
      } catch (e) {
        console.error("feedback submission failed", e);
      }
    },
    [api, refreshAlert],
  );

  return (
    <>
      <AlertsLayout
        headerSlot={
          <StreamStatusIndicator
            status={streamStatus}
            lastUpdatedAt={lastUpdatedAt}
            onReconnect={reconnectStream}
          />
        }
      >
        <AlertList
          alerts={alerts}
          status={status}
          error={error}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </AlertsLayout>
      <AlertDetailDrawer
        alert={selected}
        onClose={() => setSelectedId(null)}
        onDecision={handleDecision}
        evidenceApi={evidenceApi}
      />
    </>
  );
}
