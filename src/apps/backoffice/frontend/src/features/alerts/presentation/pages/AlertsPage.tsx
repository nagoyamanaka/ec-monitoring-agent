import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AlertView } from "../../domain/AlertView";
import { AlertsLayout } from "@shared/layouts/AlertsLayout";
import type { DemoApi } from "@features/demo/infrastructure/demoApi";
import { DemoDrawer } from "@features/demo/presentation/DemoDrawer";
import { useAlertsData } from "../AlertsDataProvider";
import {
  submitFeedback,
  type FeedbackDecision,
} from "../../application/submitFeedback";
import { reinvestigate } from "../../application/reinvestigate";
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

  // 既知一致のオンデマンド AI 調査（202／レポート添付は SSE で届く）。
  const handleGenerateReport = useCallback(
    async (alertId: string) => {
      try {
        await api.requestReport(alertId);
      } catch (e) {
        console.error("report request failed", e);
      }
    },
    [api],
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
        onGenerateReport={handleGenerateReport}
        onPromote={handlePromote}
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
