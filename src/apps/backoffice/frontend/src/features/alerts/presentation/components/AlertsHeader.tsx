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
  /**
   * 価値説明の段落を出さない（FirstRunGuide 表示中）。ファーストビューで
   * ガイド・段落と価値説明が二重になるのを避ける＝説明は常に1枚だけ（say it once）。
   */
  hideIntro?: boolean;
}

/** 絞り込みチップ群の導線ラベルに使う漏斗（フィルタ）アイコン。 */
function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={cn("h-3 w-3", className)}
    >
      <path d="M1.5 2h13a.5.5 0 0 1 .39.812L10 9.05V13a.5.5 0 0 1-.276.447l-3 1.5A.5.5 0 0 1 6 14.5V9.05L1.11 2.812A.5.5 0 0 1 1.5 2Z" />
    </svg>
  );
}

/**
 * クリック可能な件数チップ。0件は淡色化して無効（絞っても空になるだけ）。
 * 「押せる」ことが見た目で分かるよう、選択中は ✓＋✕（解除）を、非選択は hover で
 * リングを強調する（E2: バッジと誤認されない導線）。
 */
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
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
        toneCls,
        empty && "opacity-40",
        // L10 例外: フィルタトグルチップは面（brightness）を上げつつ、選択状態（active=ring-2）を hover でプレビューする。ring=選択セマンティクスなので規約内。
        !empty && onToggle && "cursor-pointer hover:brightness-125 hover:ring-2",
        active && "ring-2",
      )}
      title={
        empty
          ? `${label}は現在 0 件です`
          : active
            ? "クリックで絞り込みを解除"
            : `クリックで${label}のみ表示`
      }
    >
      {active && (
        <span aria-hidden className="font-medium">
          ✓
        </span>
      )}
      {label} {count}件
      {active && (
        <span aria-hidden className="ml-0.5 opacity-70">
          ✕
        </span>
      )}
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
  hideIntro = false,
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
      {!hideIntro && (
        <p className="text-[15px] leading-relaxed text-slate-200">
          アラートの
          <span className="font-medium text-cyan-300">調査・評価・報告</span>
          を AI エージェントが肩代わり — 未知の障害は証拠つきで原因を提示し、
          承認するとその判断を学習して次回から1秒未満で確定します。
        </p>
      )}

      {/* 作業指標になる数だけ出す（総件数は出さない）。
          絞り込みチップは導線ラベル（漏斗＋「クリックで絞り込み」）でグルーピングし、
          クリックできない状態表示（分析中）は区切りの右へ分離する（E2）。 */}
      {status === "ready" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {onFilterToggle && (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <FunnelIcon />
              クリックで絞り込み:
            </span>
          )}
          <FilterChip
            label="レビュー待ち"
            count={pending}
            active={activeFilter === "pending"}
            toneCls="bg-amber-500/15 text-amber-300 ring-amber-500/30"
            onToggle={
              onFilterToggle ? () => onFilterToggle("pending") : undefined
            }
          />
          <FilterChip
            label="CRITICAL"
            count={critical}
            active={activeFilter === "critical"}
            toneCls="bg-rose-500/15 text-rose-300 ring-rose-500/30"
            onToggle={
              onFilterToggle ? () => onFilterToggle("critical") : undefined
            }
          />
          {analyzing > 0 && (
            <>
              <span aria-hidden className="h-3.5 w-px bg-slate-700" />
              <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 font-medium text-cyan-300">
                分析中 {analyzing}件
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
