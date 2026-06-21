import { useState } from "react";
import { Card, ConfidenceGauge } from "@shared/ui/tremor";
import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { cn } from "@shared/ui/cn";
import {
  type AlertView,
  isAnalyzing,
  primaryConfidence,
} from "../domain/AlertView";
import type { FeedbackDecision } from "../application/submitFeedback";
import { AlertCardExpanded } from "./AlertCardExpanded";

export interface AlertCardProps {
  alert: AlertView;
  onDecision?: (
    alertId: string,
    decision: FeedbackDecision,
  ) => void | Promise<void>;
  /** 初期展開状態（詳細導線やデモ演出で使用）。 */
  defaultExpanded?: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * 一覧の 1 件カード。ヘッダ（severity・category・確信度ゲージ・分析中インジケータ）を
 * クリックすると AlertCardExpanded をインライン展開する。
 */
export function AlertCard({
  alert,
  onDecision,
  defaultExpanded = false,
}: AlertCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const analyzing = isAnalyzing(alert);
  const confidence = primaryConfidence(alert);

  return (
    <Card className="!p-0 !ring-slate-700/60 transition hover:!ring-slate-600">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
          </div>
          <div className="truncate text-sm font-semibold text-slate-100">
            {alert.eventName}
          </div>
          <div className="truncate text-xs text-slate-500">
            {alert.source} · {formatTime(alert.occurredOn)}
          </div>
        </div>

        {confidence !== null && (
          <ConfidenceGauge confidence={confidence} size="sm" />
        )}
        <span
          className={cn(
            "text-slate-500 transition-transform",
            expanded && "rotate-90",
          )}
          aria-hidden
        >
          ›
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/60 px-4 py-4">
          <AlertCardExpanded alert={alert} onDecision={onDecision} />
        </div>
      )}
    </Card>
  );
}
