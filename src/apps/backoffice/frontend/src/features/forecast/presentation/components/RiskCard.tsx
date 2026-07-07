import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { ClockIcon, ShieldIcon } from "@shared/ui/icons";
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
          <h3 className="flex items-center gap-1.5 text-lg font-semibold text-slate-50">
            <ClockIcon className="shrink-0 text-slate-400" />
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
      {/* F11a: 先手＝カード内の視覚的主役。実行主体は人間（write-zero）＝ボタンにしない。
          実行先（PR/plan/過去事例）への動線は下の CitationList の実リンクが担う。
          LLM が出さなければフィールドごと欠落＝このブロックが消えるだけの縮退。 */}
      {risk.preventiveAction && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
          <p className="flex flex-wrap items-center justify-between gap-x-3 text-[11px] font-semibold tracking-wide text-cyan-300">
            <span className="inline-flex items-center gap-1">
              <ShieldIcon className="shrink-0" />
              今打てる先手
            </span>
            <span className="font-normal text-slate-400">
              実行先は下の引用リンクから
            </span>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-cyan-100">
            {risk.preventiveAction}
          </p>
        </div>
      )}
      <CitationList citations={risk.citations} />
    </article>
  );
}
