import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AlertView } from "../../domain/AlertView";
import { AlertsLayout } from "@shared/layouts/AlertsLayout";
import type { DemoApi } from "@features/demo/infrastructure/demoApi";
import { DemoDrawer } from "@features/demo/presentation/DemoDrawer";
import type { AnalyticsApi } from "@features/analytics/infrastructure/analyticsApi";
import { ValueStrip } from "@features/analytics/presentation/ValueStrip";
import { useForecastNav } from "@features/forecast/presentation/ForecastProvider";
import { useAlertsData } from "../AlertsDataProvider";
import {
  submitFeedback,
  type FeedbackDecision,
} from "../../application/submitFeedback";
import { reinvestigate } from "../../application/reinvestigate";
import { AlertList } from "../components/AlertList";
import { AlertDetailDrawer } from "../components/AlertDetailDrawer";
import { FirstRunGuide } from "../components/FirstRunGuide";
import { StreamStatusIndicator } from "../components/StreamStatusIndicator";

export interface AlertsPageProps {
  /** デモ操作卓 API（composition root で生成して注入）。 */
  demoApi: DemoApi;
  /** 実績ストリップ用 Analytics API（composition root で生成して注入）。 */
  analyticsApi: AnalyticsApi;
}

/**
 * アラート一覧ページ（デモの舞台＝AlertsLayout）。
 * 一覧 state / SSE は AlertsDataProvider（Router 直下）が保持＝遷移で切れない。本ページは
 * 共有 state を `useAlertsData()` で読むだけ。一覧（マスター）＋行クリックで右ドロワー（detail）。
 * 選択中 alert は共有 alerts から都度引く＝SSE 更新がドロワーにもライブ反映される。
 */
export function AlertsPage({ demoApi, analyticsApi }: AlertsPageProps) {
  const {
    alerts,
    status,
    error,
    retrying,
    streamStatus,
    lastUpdatedAt,
    lastEvent,
    lastIncomingAlert,
    refreshAlert,
    refreshAlerts,
    reconnectStream,
    remediationByAlertId,
    investigationProgressByAlertId,
    api,
    evidenceApi,
    remediationApi,
  } = useAlertsData();

  // 選択中の alert を URL の ?focus= に持つ＝開閉が履歴に乗り、ブラウザ「戻る」で
  // 直前のオーバレイ位置に復元できる（ドロワーは deep-link/共有可能にもなる）。
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("focus");
  const setFocus = useCallback(
    (id: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id === null) next.delete("focus");
        else next.set("focus", id);
        return next;
      });
    },
    [setParams],
  );
  // オーバレイ内で辿ってきた前アラートの id を積む（ドロワーの「← 戻る」用）。
  // ブラウザの戻るはモーダル表示中に気づかれにくいので、明示ボタンを出す（デグレ復旧）。
  const [backStack, setBackStack] = useState<string[]>([]);
  // 一覧からの新規オープンは探索の起点＝履歴をリセットする。
  const openFocus = useCallback(
    (id: string) => {
      setBackStack([]);
      setFocus(id);
    },
    [setFocus],
  );
  // 関連アラートを辿るときは現在地を積んでから遷移＝「戻る」で前のドロワーに復元できる。
  const navigateRelated = useCallback(
    (id: string) => {
      setBackStack((s) => (selectedId ? [...s, selectedId] : s));
      setFocus(id);
    },
    [setFocus, selectedId],
  );
  const goBack = useCallback(() => {
    const prev = backStack[backStack.length - 1];
    if (prev === undefined) return;
    setBackStack((s) => s.slice(0, -1));
    setFocus(prev);
  }, [backStack, setFocus]);
  const closeFocus = useCallback(() => {
    setBackStack([]);
    setFocus(null);
  }, [setFocus]);
  // 現役アラートは共有一覧から引く。一覧に無い id（＝解決済みアーカイブ：関連アラートの
  // back-link 先など。RESOLVED は一覧に出さない）は GET /alerts/:id で単発取得して開く。
  const inList = useMemo(
    () => alerts.find((a) => a.id === selectedId) ?? null,
    [alerts, selectedId],
  );
  const [fetched, setFetched] = useState<AlertView | null>(null);
  useEffect(() => {
    if (!selectedId || inList) {
      setFetched(null);
      return;
    }
    let cancelled = false;
    api
      .getAlert(selectedId)
      .then((a) => {
        if (!cancelled) setFetched(a);
      })
      .catch(() => {
        if (!cancelled) setFetched(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, inList, api]);
  const selected =
    inList ?? (fetched && fetched.id === selectedId ? fetched : null);
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

  // 既知一致のオンデマンド AI 調査（202）。backend は要求受理時に ANALYZING へ遷移して即 push する
  // ので調査中が即可視化される（レポート添付は完了後 SSE）。SSE 取りこぼしに備え自前でも再取得する。
  const handleGenerateReport = useCallback(
    async (alertId: string) => {
      try {
        await api.requestReport(alertId);
        await refreshAlert(alertId);
      } catch (e) {
        console.error("report request failed", e);
      }
    },
    [api, refreshAlert],
  );

  // 手動即時昇格（結晶化）。昇格後の一覧はパターン側なので再取得は不要だが、UI 整合のため対象を更新。
  const handlePromote = useCallback(
    async (alertId: string) => {
      try {
        await api.promote(alertId);
        await refreshAlert(alertId);
      } catch (e) {
        console.error("promote request failed", e);
      }
    },
    [api, refreshAlert],
  );

  // Forecast タブの表示可否＋HIGH バッジ（FORECAST_ENABLED off なら非表示・F7）。
  const forecastNav = useForecastNav();

  return (
    <>
      <AlertsLayout
        forecastEnabled={forecastNav.enabled}
        forecastBadge={forecastNav.badge}
        headerSlot={
          <StreamStatusIndicator
            status={streamStatus}
            lastUpdatedAt={lastUpdatedAt}
            lastEvent={lastEvent}
            onReconnect={reconnectStream}
          />
        }
        demoDrawer={
          <DemoDrawer
            api={demoApi}
            onAfterReset={refreshAlerts}
            lastIncomingAlert={lastIncomingAlert}
          />
        }
      >
        <div className="space-y-4">
          <FirstRunGuide />
          <ValueStrip
            api={analyticsApi}
            refreshKey={lastUpdatedAt?.getTime() ?? null}
          />
          <AlertList
            alerts={alerts}
            status={status}
            error={error}
            retrying={retrying}
            onRetry={refreshAlerts}
            selectedId={selectedId}
            onSelect={openFocus}
          />
        </div>
      </AlertsLayout>
      <AlertDetailDrawer
        alert={selected}
        onClose={closeFocus}
        onBack={backStack.length > 0 ? goBack : undefined}
        onDecision={handleDecision}
        onReinvestigate={handleReinvestigate}
        onGenerateReport={handleGenerateReport}
        onPromote={handlePromote}
        evidenceApi={evidenceApi}
        remediationApi={remediationApi}
        pushedRemediation={
          selectedId ? remediationByAlertId.get(selectedId) ?? null : null
        }
        investigationProgress={
          selectedId
            ? investigationProgressByAlertId.get(selectedId) ?? []
            : []
        }
        relatedLookup={relatedLookup}
        alerts={alerts}
        onRelatedNavigate={navigateRelated}
      />
    </>
  );
}
