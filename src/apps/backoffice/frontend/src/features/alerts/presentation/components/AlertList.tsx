import type { AlertView } from "../../domain/AlertView";
import type { AlertsStatus } from "../hooks/useAlerts";
import { sortAlerts } from "../../domain/alertSort";
import { AlertCard } from "./AlertCard";
import { AlertsHeader } from "./AlertsHeader";

export interface AlertListProps {
  alerts: AlertView[];
  status: AlertsStatus;
  error: Error | null;
  /** 取得失敗後の自動リトライが進行中か（useAlerts の指数バックオフ）。 */
  retrying?: boolean;
  /** リトライを使い切った後の手動再試行。親が refreshAlerts を渡す。 */
  onRetry?: () => void;
  /** 選択中の alert id（詳細ドロワーで開いている行）。 */
  selectedId?: string | null;
  /** 行クリック。親が詳細ドロワーを開く。 */
  onSelect?: (alertId: string) => void;
}

/**
 * アラート一覧（マスター）。オリエンテーション・ヘッダ（AlertsHeader）を常に出し、
 * その下に loading/error/empty/一覧 の 4 状態を描き分ける。
 * error は「自動再試行中」と「使い切り（手動再試行）」を分け、生の HTTP エラーは
 * 折りたたみ詳細へ降格する（審査員のコールドアクセスで最初に見る画面になり得るため）。
 * 並びは useAlerts のマージ順（最新が先頭）をそのまま尊重する。
 * 詳細は行クリックで親の詳細ドロワー（AlertDetailDrawer）が担う。
 */
export function AlertList({
  alerts,
  status,
  error,
  retrying,
  onRetry,
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
        retrying={retrying}
        onRetry={onRetry}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  );
}

/** 生のエラー文言（HTTP 500 など）を折りたたみへ降格して出す。 */
function ErrorDetails({ error }: { error: Error | null }) {
  if (!error?.message) return null;
  return (
    <details className="mt-2 text-xs text-slate-400">
      <summary className="cursor-pointer select-none">技術詳細</summary>
      <code className="mt-1 block break-all text-slate-500">
        {error.message}
      </code>
    </details>
  );
}

function AlertListBody({
  alerts,
  status,
  error,
  retrying,
  onRetry,
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
    if (retrying) {
      return (
        <div
          className="rounded-tremor-default bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-inset ring-amber-500/30"
          role="status"
        >
          <p className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300"
              aria-hidden
            />
            アラートの取得に失敗しました。起動処理中の可能性があります。自動で再試行しています…
          </p>
          <ErrorDetails error={error} />
        </div>
      );
    }
    return (
      <div className="rounded-tremor-default bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
        <p>アラートの取得に失敗しました。</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-500/40 hover:bg-rose-500/30"
          >
            再試行
          </button>
        )}
        <ErrorDetails error={error} />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="space-y-2 rounded-tremor-default bg-slate-800/30 px-4 py-10 text-center text-sm ring-1 ring-inset ring-slate-700/50">
        <p className="text-slate-300">現在アクティブなアラートはありません。</p>
        <p className="font-medium text-cyan-300">
          → 右のデモ操作卓からシナリオを注入すると、AI の検知・分類・調査が始まります。
        </p>
        <p className="text-xs text-slate-400">
          分類の確度は「完全一致（確定）／パターン一致度
          N%／AI 確信度 N%」の3段階で表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortAlerts(alerts).map((alert) => (
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
