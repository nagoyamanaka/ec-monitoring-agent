import type { AlertView } from "../domain/AlertView";
import type { AlertsStatus } from "../presentation/hooks/useAlerts";
import { sortForTriage } from "../domain/alertSort";
import { AlertCard } from "./AlertCard";
import { AlertsHeader } from "./AlertsHeader";

export interface AlertListProps {
  alerts: AlertView[];
  status: AlertsStatus;
  error: Error | null;
  /** 選択中の alert id（詳細ドロワーで開いている行）。 */
  selectedId?: string | null;
  /** 行クリック。親が詳細ドロワーを開く。 */
  onSelect?: (alertId: string) => void;
}

/**
 * アラート一覧（マスター）。オリエンテーション・ヘッダ（AlertsHeader）を常に出し、
 * その下に loading/error/empty/一覧 の 4 状態を描き分ける。
 * 並びは useAlerts のマージ順（最新が先頭）をそのまま尊重する。
 * 詳細は行クリックで親の詳細ドロワー（AlertDetailDrawer）が担う。
 */
export function AlertList({
  alerts,
  status,
  error,
  selectedId,
  onSelect,
}: AlertListProps) {
  return (
    <div className="w-full max-w-4xl space-y-4">
      <AlertsHeader alerts={alerts} status={status} />
      <AlertListBody
        alerts={alerts}
        status={status}
        error={error}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  );
}

function AlertListBody({
  alerts,
  status,
  error,
  selectedId,
  onSelect,
}: AlertListProps) {
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
      {sortForTriage(alerts).map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          selected={alert.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
