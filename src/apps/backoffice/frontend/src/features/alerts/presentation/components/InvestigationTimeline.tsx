import type { InvestigationStepView } from "../../domain/InvestigationReportView";
import { humanizeAgentNames } from "../../domain/investigationStepText";
import { InvestigationItem } from "./InvestigationItem";

/**
 * 調査ステップの縦タイムライン（タスク E8-B・報告用フルのみ）。
 * ol の箇条書きを接続線＋ノードの時系列表現に格上げし、AI がたどった道筋を構造で見せる。
 * ステップ毎の時刻は記録していないため出さない（順序のみ＝時刻の捏造をしない。
 * F8 でタイムチャートを不採用にしたのと同じ判断）。本文中の生エージェント名は
 * 表示時に人間語化する（humanizeAgentNames）。
 */
export function InvestigationTimeline({
  steps,
}: {
  steps: readonly InvestigationStepView[];
}) {
  return (
    <ol className="relative ml-1.5 space-y-2.5 border-l border-slate-700/60 pl-4">
      {steps.map((step, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden
            className="absolute -left-[21px] top-[5px] h-2 w-2 rounded-full bg-cyan-400/80 ring-2 ring-cyan-500/20"
          />
          <InvestigationItem
            item={{ ...step, text: humanizeAgentNames(step.text) }}
          />
        </li>
      ))}
    </ol>
  );
}
