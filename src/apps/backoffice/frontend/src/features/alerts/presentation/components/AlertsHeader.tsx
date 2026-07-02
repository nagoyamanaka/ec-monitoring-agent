import { cn } from "@shared/ui/cn";
import type { AlertView } from "../../domain/AlertView";
import { alertWorkState } from "../../domain/alertReview";
import type { AlertsStatus } from "../hooks/useAlerts";

/** 一覧の絞り込み軸。ヘッダのチップをクリックしてトグルする。 */
export type AlertListFilter = "pending" | "critical";

/** フィルタ本体（AlertList の絞り込みとチップの件数で共有する単一ソース）。 */
export function matchesAlertFilter(
  alert: AlertView,
  filter: AlertListFilter,
): boolean {
  return filter === "pending"
    ? alertWorkState(alert) === "PENDING"
    : alert.severity === "CRITICAL";
}

export interface AlertsHeaderProps {
  alerts: AlertView[];
  status: AlertsStatus;
  /** 選択中のフィルタ（null=絞り込みなし）。 */
  activeFilter?: AlertListFilter | null;
  /** チップクリックでフィルタをトグルする。未指定ならチップは表示のみ。 */
  onFilterToggle?: (filter: AlertListFilter) => void;
}

/** クリック可能な件数チップ。0件は淡色化して無効（絞っても空になるだけ）。 */
function FilterChip({
  label,
  count,
  active,
  toneCls,
  onToggle,
}: {
  label: string;
  count: number;
  active: boolean;
  toneCls: string;
  onToggle?: () => void;
}) {
  const empty = count === 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={empty || !onToggle}
      onClick={onToggle}
      className={cn(
        "rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset transition",
        toneCls,
        empty && "opacity-40",
        !empty && onToggle && "cursor-pointer hover:brightness-125",
        active && "ring-2",
      )}
      title={
        empty
          ? undefined
          : active
            ? "クリックで絞り込みを解除"
            : `クリックで${label}のみ表示`
      }
    >
      {label} {count}件
    </button>
  );
}

/**
 * 一覧のオリエンテーション（この画面の価値が何か）を伝えるヘッダ。
 * 説明文は機構の説明でなく価値の主張にする（G2: 開いた人が5秒で「何の価値か」を掴む。
 * 機構の3ステップは FirstRunGuide 側が担う）。
 * 件数チップはカードバッジと同じ alertWorkState（単一ソース）で数え、
 * クリックで一覧をその軸に絞り込める（E2）。件数は ready 時のみ表示。
 */
export function AlertsHeader({
  alerts,
  status,
  activeFilter = null,
  onFilterToggle,
}: AlertsHeaderProps) {
  const critical = alerts.filter((a) =>
    matchesAlertFilter(a, "critical"),
  ).length;
  const pending = alerts.filter((a) => matchesAlertFilter(a, "pending")).length;
  const analyzing = alerts.filter(
    (a) => alertWorkState(a) === "ANALYZING",
  ).length;

  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-slate-200">
        アラート発火後の
        <span className="font-semibold text-cyan-300">調査・評価・報告</span>
        を AI エージェントが肩代わりします。既知の障害は1秒未満で確定、
        未知の障害は証拠つきで原因を提示 —
        承認するとその判断を学習し、次回から即時判定になります。
      </p>

      {/* 作業指標になる数だけ出す（総件数は出さない）。チップはクリックで絞り込み。 */}
      {status === "ready" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FilterChip
            label="レビュー待ち"
            count={pending}
            active={activeFilter === "pending"}
            toneCls="bg-amber-500/15 text-amber-300 ring-amber-500/30"
            onToggle={
              onFilterToggle ? () => onFilterToggle("pending") : undefined
            }
          />
          {analyzing > 0 && (
            <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 font-medium text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
              分析中 {analyzing}件
            </span>
          )}
          <FilterChip
            label="CRITICAL"
            count={critical}
            active={activeFilter === "critical"}
            toneCls="bg-rose-500/15 text-rose-300 ring-rose-500/30"
            onToggle={
              onFilterToggle ? () => onFilterToggle("critical") : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
