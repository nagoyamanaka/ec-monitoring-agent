import { useCallback, useMemo } from "react";
import { FetchHttpClient } from "@shared/api/FetchHttpClient";
import { AlertsLayout } from "@shared/layouts/AlertsLayout";
import { createAlertsApi } from "../infrastructure/alertsApi";
import { SSEAlertStream } from "../infrastructure/SSEAlertStream";
import { useAlerts } from "../presentation/hooks/useAlerts";
import {
  submitFeedback,
  type FeedbackDecision,
} from "../application/submitFeedback";
import { AlertList } from "../components/AlertList";

/**
 * アラート一覧ページ（デモの舞台＝AlertsLayout）。
 * api/stream は composition root としてここで生成し、useMemo で安定参照にする
 * （毎レンダー再生成すると useAlerts/useAlertStream が再購読してしまうため）。
 */
export function AlertsPage() {
  const api = useMemo(() => createAlertsApi(new FetchHttpClient()), []);
  const stream = useMemo(() => new SSEAlertStream(), []);
  const { alerts, status, error } = useAlerts(api, stream);

  const handleDecision = useCallback(
    (alertId: string, decision: FeedbackDecision) =>
      submitFeedback(api, { alertId, decision }).catch((e) => {
        console.error("feedback submission failed", e);
      }),
    [api],
  );

  return (
    <AlertsLayout>
      <AlertList
        alerts={alerts}
        status={status}
        error={error}
        onDecision={handleDecision}
      />
    </AlertsLayout>
  );
}
