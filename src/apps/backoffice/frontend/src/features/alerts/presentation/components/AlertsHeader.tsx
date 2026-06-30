import type { AlertView } from "../../domain/AlertView";
import type { AlertsStatus } from "../hooks/useAlerts";

export interface AlertsHeaderProps {
  alerts: AlertView[];
  status: AlertsStatus;
}

/**
 * 一覧のオリエンテーション（この画面が何か）を伝えるヘッダ。
 * 初見でも「AI が分類・調査したアラートを人がレビューする画面」だと分かるよう、
 * 説明文・件数サマリを出す。件数は ready 時のみ（loading 中の 0 件表示を避ける）。
 */
export function AlertsHeader({ alerts, status }: AlertsHeaderProps) {
  const critical = alerts.filter((a) => a.severity === "CRITICAL").length;
  const pending = alerts.filter(
    (a) => a.report?.reviewStatus === "PENDING_REVIEW",
  ).length;
  const analyzing = alerts.filter((a) => a.status === "ANALYZING").length;

  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-slate-200">
        AI が検知・分類・調査したアラートのレビュー一覧です。行をクリックで詳細を確認し、
        <span className="font-semibold text-cyan-300">承認 / 却下</span>
        で AI の学習に反映します。
      </p>

      {/* 作業指標になる数だけ出す（総件数は出さない） */}
      {status === "ready" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
            レビュー待ち {pending}件
          </span>
          {analyzing > 0 && (
            <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 font-medium text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
              分析中 {analyzing}件
            </span>
          )}
          <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 font-medium text-rose-300 ring-1 ring-inset ring-rose-500/30">
            CRITICAL {critical}件
          </span>
        </div>
      )}
    </div>
  );
}
