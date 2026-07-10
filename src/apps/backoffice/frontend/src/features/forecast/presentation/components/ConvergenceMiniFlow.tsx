import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { convergenceLanes } from "../../domain/ForecastView";
import type { RiskCardView } from "../../domain/ForecastView";
import { riskLevelLabel } from "../../domain/RiskLevel";
import { laneTone, LANE_TILE_CLASS } from "./laneColors";

/**
 * 収束ミニフロー（U1③）: アラート詳細「証拠の流れ」（EvidenceFlowDiagram）と同じ視覚言語で
 * 「入力（根拠の種類別件数）→ AI 調査（独立した根拠を突合）→ 結論（レベル＋確信度）」の
 * 収束構造を横ストリップで見せる。見出し語彙はアラート詳細の EvidenceFlowDiagram と統一。
 *
 * これが「なぜ HIGH か」の回答（②a）＝どの独立した種類が何件重なったかを **LLM 文ではなく構造** で示す。
 * 件数は citations を kind でグルーピングした決定論値（convergenceLanes）。数字を盛る経路が無い。
 * 視覚部は aria-hidden とし、読み上げは冒頭の1文サマリで代替する。
 */
export interface ConvergenceMiniFlowProps {
  risk: RiskCardView;
}

export function ConvergenceMiniFlow({ risk }: ConvergenceMiniFlowProps) {
  const lanes = convergenceLanes(risk.citations);
  if (lanes.length === 0) return null;

  const percent = Math.round(risk.confidence * 100);
  const ariaSummary = `${lanes
    .map((l) => `${l.kindLabel}${l.count}件`)
    .join("・")}を AI が突合し ${riskLevelLabel(risk.level)}（確信度${percent}%）と判定`;

  return (
    <section
      aria-label="収束のミニフロー"
      className="space-y-2 rounded-lg bg-slate-800/40 p-3"
    >
      <p className="sr-only">{ariaSummary}</p>
      <div
        aria-hidden
        className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-0"
      >
        {/* 入力レーン（根拠の種類別件数・0件レーンは convergenceLanes 側で出ない） */}
        <ul className="min-w-0 flex-1 space-y-1.5">
          {lanes.map((lane) => (
            <li key={lane.kind} className="flex items-center">
              <span
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ring-1 ring-inset ${
                  LANE_TILE_CLASS[laneTone(lane.kind)]
                }`}
              >
                <span className="truncate">{lane.kindLabel}</span>
                <span className="ml-auto shrink-0 font-semibold tabular-nums">
                  {lane.count}件
                </span>
              </span>
              <span className="hidden h-px w-6 shrink-0 rounded-full bg-slate-600 md:block" />
            </li>
          ))}
        </ul>

        <span className="text-center text-slate-500 md:hidden">▼</span>

        {/* 調査ノード（収束点）＝AI が独立した根拠を突合して束ねる。見出し「AI 調査」は
            アラート詳細の証拠フロー（EvidenceFlowDiagram）と同一語彙で統一。
            具象LLM（Gemini/Vertex）はポートの向こう＝UI では名指しせず "AI" で統一。
            配色は中間工程＝中立面＋cyan の枠だけ（発光は結論ノードの確信度に譲る）。 */}
        <div className="shrink-0 self-center rounded-lg bg-slate-800/60 px-4 py-3 text-center ring-1 ring-inset ring-cyan-500/30">
          <p className="text-sm font-medium text-slate-200">AI 調査</p>
          <p className="mt-0.5 text-xs text-slate-400">独立した根拠を突合</p>
        </div>

        <span className="text-center text-slate-500 md:hidden">▼</span>
        <span className="hidden shrink-0 px-1.5 text-slate-500 md:block">
          ▶
        </span>

        {/* 結論ノード（レベル＋確信度%）。subject はカード見出し（この直上）が担うため
            ここでは重複表示せず、収束の帰結＝深刻度に焦点を当てる。 */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 self-center rounded-lg bg-slate-800/50 px-4 py-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            結論に収束
          </p>
          <div className="flex items-center gap-2">
            {/* 「顔」の HIGH バッジはカード上部が単独で担うため、ここは人間語ラベルで再掲する
                （バッジ色は流用しつつ二重の "HIGH" 文字は出さない）。 */}
            <SeverityBadge level={risk.level} label={riskLevelLabel(risk.level)} />
            <span className="text-xs font-semibold tabular-nums text-cyan-300">
              確信度 {percent}%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
