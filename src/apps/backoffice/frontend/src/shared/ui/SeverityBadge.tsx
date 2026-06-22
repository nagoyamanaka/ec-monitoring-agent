import { cn } from "./cn";

/**
 * 危険度ランクバッジ。AlertSeverity（CRITICAL/WARNING/INFO）と
 * 予兆の RiskLevel（HIGH/MEDIUM/LOW）の両方に転用する（step4-4: SeverityBadge を RiskLevel に転用）。
 * ダーク観測コンソール配色のランク色を素の Tailwind パレットで持つ（tailwind 拡張に非依存）。
 */
export type SeverityLevel =
  | "CRITICAL"
  | "WARNING"
  | "INFO"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "PENDING";

const RANK_STYLE: Record<SeverityLevel, string> = {
  CRITICAL: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  HIGH: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  WARNING: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  INFO: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  LOW: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  PENDING: "bg-slate-500/15 text-slate-400 ring-slate-500/30",
};

export interface SeverityBadgeProps {
  level: SeverityLevel;
  /** 既定はラベル＝level。RiskLevel で別表記したい場合に上書き。 */
  label?: string;
  className?: string;
}

export function SeverityBadge({ level, label, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset",
        RANK_STYLE[level],
        className,
      )}
    >
      {label ?? level}
    </span>
  );
}
