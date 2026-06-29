import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertsLayout } from "@shared/layouts/AlertsLayout";
import type { DemoApi } from "@features/demo/infrastructure/demoApi";
import { DemoDrawer } from "@features/demo/presentation/DemoDrawer";
import { useAlertsData } from "../presentation/AlertsDataProvider";
import {
  submitFeedback,
  type FeedbackDecision,
} from "../application/submitFeedback";
import { reinvestigate } from "../application/reinvestigate";
import { AlertList } from "../components/AlertList";
import { AlertDetailDrawer } from "../components/AlertDetailDrawer";
import { StreamStatusIndicator } from "../components/StreamStatusIndicator";

export interface AlertsPageProps {
  /** デモ操作卓 API（composition root で生成して注入）。 */
  demoApi: DemoApi;
}

/**
 * アラート一覧ページ（デモの舞台＝AlertsLayout）。
 * 一覧 state / SSE は AlertsDataProvider（Router 直下）が保持＝遷移で切れない。本ページは
 * 共有 state を `useAlertsData()` で読むだけ。一覧（マスター）＋行クリックで右ドロワー（detail）。
 * 選択中 alert は共有 alerts から都度引く＝SSE 更新がドロワーにもライブ反映される。
 */
export function AlertsPage({ demoApi }: AlertsPageProps) {
  const {
    alerts,
    status,
    error,
    streamStatus,
    lastUpdatedAt,
    refreshAlert,
    refreshAlerts,
    reconnectStream,
    remediationByAlertId,
    api,
    evidenceApi,
    remediationApi,
  } = useAlertsData();

  // 選択中の alert を URL の ?focus= に持つ＝開閉が履歴に乗り、ブラウザ「戻る」で
  // 直前のオーバレイ位置に復元できる（ドロワーは deep-link/共有可能にもなる）。
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("focus");
  const openFocus = useCallback(
    (id: string) => {
      // push（replace しない）＝関連アラートを辿るたびに履歴を積み、戻るで遡れる。
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("focus", id);
        return next;
      });
    },
    [setParams],
  );
  const closeFocus = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("focus");
      return next;
    });
  }, [setParams]);
  const selected = useMemo(
    () => alerts.find((a) => a.id === selectedId) ?? null,
    [alerts, selectedId],
  );
  // 関連アラート（タスク9e）の日時/severity 補完用。一覧から alertId を解決する。
  const relatedLookup = useCallback(
    (id: string) => alerts.find((a) => a.id === id),
    [alerts],
  );

  const handleDecision = useCallback(
    async (alertId: string, decision: FeedbackDecision, operatorNote?: string) => {
      try {
        await submitFeedback(api, { alertId, decision, operatorNote });
        // PATCH は ok のみ返し SSE push も無いため、自前で再取得して reviewStatus を反映する
        await refreshAlert(alertId);
      } catch (e) {
        console.error("feedback submission failed", e);
      }
    },
    [api, refreshAlert],
  );

  const handleReinvestigate = useCallback(
    async (alertId: string, operatorNote: string) => {
      try {
        await reinvestigate(api, { alertId, operatorNote });
        // 202 直後に ANALYZING（再調査中）を即時反映。確定（OPEN＋新レポート）は SSE で届く。
        await refreshAlert(alertId);
      } catch (e) {
        console.error("reinvestigation request failed", e);
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
        demoDrawer={<DemoDrawer api={demoApi} onAfterReset={refreshAlerts} />}
      >
        <AlertList
          alerts={alerts}
          status={status}
          error={error}
          selectedId={selectedId}
          onSelect={openFocus}
        />
      </AlertsLayout>
      <AlertDetailDrawer
        alert={selected}
        onClose={closeFocus}
        onDecision={handleDecision}
        onReinvestigate={handleReinvestigate}
        evidenceApi={evidenceApi}
        remediationApi={remediationApi}
        pushedRemediation={
          selectedId ? remediationByAlertId.get(selectedId) ?? null : null
        }
        relatedLookup={relatedLookup}
        onRelatedNavigate={openFocus}
      />
    </>
  );
}
