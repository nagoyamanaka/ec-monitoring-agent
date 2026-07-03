import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { ConfidenceBar } from "@shared/ui/tremor";
import { citationKindCount } from "../../domain/ForecastView";
import type { RiskCardView } from "../../domain/ForecastView";
import { riskLevelLabel } from "../../domain/RiskLevel";
import { CitationList } from "./CitationList";

/**
 * 予兆リスク1件のカード（step6 F7）: 「いつ危ないか」が予報の答えなので **window を主見出し**、
 * subject は補足行に置く（horizon「今週末」はページ側のメタ情報）。level 色は SeverityBadge
 * （HIGH/MEDIUM/LOW 転用）が担い、根拠の系統数（収束の強さ）を level の隣にチップで示す。
 */
export interface RiskCardProps {
  risk: RiskCardView;
}

export function RiskCard({ risk }: RiskCardProps) {
  const kindCount = citationKindCount(risk.citations);
  return (
    <article
      className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-5"
      aria-label={`${riskLevelLabel(risk.level)}: ${risk.subject}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold text-slate-50">
            <span aria-hidden>⏱ </span>
            {risk.window}
          </h3>
          <p className="text-sm font-medium text-slate-300">{risk.subject}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {kindCount >= 2 && (
              <span
                className="rounded-full bg-slate-700/40 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                title="独立した系統（変更予定・負荷予定・過去の記憶）が重なるほどリスクの裏付けが強い"
              >
                根拠 {kindCount}系統
              </span>
            )}
            <SeverityBadge level={risk.level} />
          </div>
          <ConfidenceBar confidence={risk.confidence} className="w-40 shrink-0" />
        </div>
      </div>
      <p className="text-sm leading-relaxed text-slate-300">{risk.reasoning}</p>
      <CitationList citations={risk.citations} />
    </article>
  );
}
