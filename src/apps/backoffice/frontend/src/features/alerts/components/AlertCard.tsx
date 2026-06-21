import { ConfidenceBar } from "@shared/ui/tremor";
import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { cn } from "@shared/ui/cn";
import {
  type AlertView,
  type AlertSeverity,
  isAnalyzing,
  primaryConfidence,
} from "../domain/AlertView";

export interface AlertCardProps {
  alert: AlertView;
  /** 選択中（詳細ドロワーを開いている行）か。ストライプ・背景を強調する。 */
  selected?: boolean;
  /** 行クリックで詳細ドロワーを開く。 */
  onSelect?: (alertId: string) => void;
}

/** severity ストライプの実色（SeverityBadge のランク色＝rose/amber/sky と整合）。 */
const STRIPE_COLOR: Record<AlertSeverity, string> = {
  CRITICAL: "bg-rose-500",
  WARNING: "bg-amber-500",
  INFO: "bg-sky-500",
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "たった今";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.round(hr / 24)}日前`;
}

function formatAbsoluteTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * 一覧の 1 行（マスター）。クリックで詳細ドロワー（AlertDetailDrawer）を開く。
 * severity ストライプ・バッジ・相対時刻・eventName・source＋summary・確信度横バーを
 * コンパクトに並べ、トリアージしやすい密度に保つ。展開は持たない（詳細はドロワー）。
 */
export function AlertCard({ alert, selected = false, onSelect }: AlertCardProps) {
  const analyzing = isAnalyzing(alert);
  const confidence = primaryConfidence(alert);
  const summary = alert.report?.summary;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect?.(alert.id)}
      className={cn(
        "relative w-full overflow-hidden rounded-tremor-default text-left ring-1 ring-inset transition",
        selected
          ? "bg-slate-800/50 ring-cyan-500/50"
          : "bg-slate-900/30 ring-slate-700/60 hover:bg-slate-800/30 hover:ring-slate-600",
      )}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-1", STRIPE_COLOR[alert.severity])}
        aria-hidden
      />
      <div className="flex flex-col gap-1.5 py-3 pl-5 pr-4">
        <div className="flex items-center gap-2">
          <SeverityBadge level={alert.severity} />
          <span className="rounded bg-slate-700/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
            {alert.category}
          </span>
          {analyzing && (
            <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
              <span className="size-1.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_6px] shadow-cyan-400/60" />
              分析中
            </span>
          )}
          <span
            className="ml-auto shrink-0 text-xs text-slate-500"
            title={formatAbsoluteTime(alert.occurredOn)}
          >
            {formatRelativeTime(alert.occurredOn)}
          </span>
        </div>

        <div className="truncate text-sm font-semibold text-slate-100">
          {alert.eventName}
        </div>

        <div className="truncate text-xs text-slate-500">
          <span className="text-slate-400">{alert.source}</span>
          {summary ? <span> · {summary}</span> : null}
        </div>

        {confidence !== null ? (
          <ConfidenceBar confidence={confidence} className="mt-1" />
        ) : analyzing ? (
          <div className="mt-1 text-xs text-cyan-300/70">AI が確信度を算出中…</div>
        ) : null}
      </div>
    </button>
  );
}
