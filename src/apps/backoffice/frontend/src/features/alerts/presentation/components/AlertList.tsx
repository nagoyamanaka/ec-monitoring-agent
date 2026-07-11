import { useState } from "react";
import type { AlertView } from "../../domain/AlertView";
import type { AlertsStatus } from "../hooks/useAlerts";
import { sortAlerts } from "../../domain/alertSort";
import { AlertCard } from "./AlertCard";
import { EmptyStateFigure } from "@shared/ui/EmptyStateFigure";
import { AlertRowSkeleton } from "@shared/ui/Skeleton";
import {
  AlertsHeader,
  matchesAlertFilter,
  type AlertListFilter,
} from "./AlertsHeader";

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
  /** FirstRunGuide 表示中はヘッダの価値段落を出さない（AlertsHeader.hideIntro に委譲）。 */
  hideIntro?: boolean;
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
  hideIntro,
}: AlertListProps) {
  // ヘッダチップ（レビュー待ち/CRITICAL）による絞り込み。同じチップの再クリックで解除。
  const [filter, setFilter] = useState<AlertListFilter | null>(null);
  const toggleFilter = (next: AlertListFilter) =>
    setFilter((cur) => (cur === next ? null : next));
  const visible = filter
    ? alerts.filter((a) => matchesAlertFilter(a, filter))
    : alerts;

  return (
    <div className="w-full max-w-4xl space-y-4">
      <AlertsHeader
        alerts={alerts}
        status={status}
        activeFilter={filter}
        onFilterToggle={toggleFilter}
        hideIntro={hideIntro}
      />
      {/* 絞り込み状態の表現はチップの ✓/✕ に一本化する（E8: 「のみ表示中」行＋解除リンクは同じ状態の三重表示で冗長だった）。 */}
      <AlertListBody
        alerts={visible}
        status={status}
        error={error}
        retrying={retrying}
        onRetry={onRetry}
        selectedId={selectedId}
        onSelect={onSelect}
        filtered={filter !== null}
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
      <code className="mt-1 block break-all text-slate-400">
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
  filtered = false,
}: AlertListProps & { filtered?: boolean }) {
  if (status === "loading") {
    return (
      <div className="space-y-5" aria-busy>
        {[0, 1, 2].map((i) => (
          <AlertRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (status === "error") {
    if (retrying) {
      return (
        <div
          className="rounded-tremor-default bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
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
      <div className="rounded-tremor-default bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
        <p>アラートの取得に失敗しました。</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-200 ring-1 ring-inset ring-rose-500/40 hover:bg-rose-500/30"
          >
            再試行
          </button>
        )}
        <ErrorDetails error={error} />
      </div>
    );
  }

  if (alerts.length === 0) {
    // 絞り込み中の 0 件は「アクティブ無し」ではない（解除導線はヘッダのチップ ✕ が担う）。
    if (filtered) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-tremor-default bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-400">
          <EmptyStateFigure className="text-slate-500" />
          絞り込み条件に一致するアラートはありません。
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-2 rounded-tremor-default bg-slate-800/40 px-4 py-10 text-center text-sm">
        <EmptyStateFigure className="mb-1 text-slate-500" />
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
    <div className="space-y-5">
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
