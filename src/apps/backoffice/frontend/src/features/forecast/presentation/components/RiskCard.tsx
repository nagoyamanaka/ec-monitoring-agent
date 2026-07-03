import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { ConfidenceBar } from "@shared/ui/tremor";
import type { RiskCardView } from "../../domain/ForecastView";
import { riskLevelLabel } from "../../domain/RiskLevel";
import { CitationList } from "./CitationList";

/**
 * 予兆リスク1件のカード（step6 F7）: window・subject・level バッジ・confidence ゲージ・
 * reasoning・引用チップ。level 色は SeverityBadge（HIGH/MEDIUM/LOW 転用）が担う。
 */
export interface RiskCardProps {
  risk: RiskCardView;
}

export function RiskCard({ risk }: RiskCardProps) {
  return (
    <article
      className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-5"
      aria-label={`${riskLevelLabel(risk.level)}: ${risk.subject}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge level={risk.level} />
        <span className="rounded-full bg-slate-700/40 px-2 py-0.5 text-[11px] font-medium text-slate-300">
          <span aria-hidden>⏱ </span>
          {risk.window}
        </span>
        <ConfidenceBar
          confidence={risk.confidence}
          className="ml-auto w-40 shrink-0"
        />
      </div>
      <h3 className="text-sm font-semibold text-slate-100">{risk.subject}</h3>
      <p className="text-sm leading-relaxed text-slate-300">{risk.reasoning}</p>
      <CitationList citations={risk.citations} />
    </article>
  );
}
