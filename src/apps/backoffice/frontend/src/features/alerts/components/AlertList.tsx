import type { AlertView } from "../domain/AlertView";
import type { AlertsStatus } from "../presentation/hooks/useAlerts";
import type { FeedbackDecision } from "../application/submitFeedback";
import { AlertCard } from "./AlertCard";

export interface AlertListProps {
  alerts: AlertView[];
  status: AlertsStatus;
  error: Error | null;
  onDecision?: (
    alertId: string,
    decision: FeedbackDecision,
  ) => void | Promise<void>;
}

/**
 * アラート一覧。loading/error/empty/一覧 の 4 状態を描き分ける。
 * 並びは useAlerts のマージ順（最新が先頭）をそのまま尊重する。
 */
export function AlertList({ alerts, status, error, onDecision }: AlertListProps) {
  if (status === "loading") {
    return (
      <div className="space-y-3" aria-busy>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-tremor-default bg-slate-800/40"
          />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-tremor-default bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
        アラートの取得に失敗しました。{error?.message}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-tremor-default bg-slate-800/30 px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-inset ring-slate-700/50">
        現在アクティブなアラートはありません。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onDecision={onDecision} />
      ))}
    </div>
  );
}
