import { ConfidenceGauge, confidenceBrandColor } from "@shared/ui/tremor";
import { cn } from "@shared/ui/cn";
import type { EvidenceFlowModel } from "../../domain/evidenceFlow";
import type {
  ConfidenceCalibrationView,
  InvestigationStepView,
} from "../../domain/InvestigationReportView";
import { INVESTIGATION_AGENTS } from "../../domain/investigationProgress";
import { mentionedAgents } from "../../domain/investigationStepText";
import { ConfidenceCalibrationNote } from "./ConfidenceCalibrationNote";

export interface EvidenceFlowDiagramProps {
  model: EvidenceFlowModel;
  /** キャリブレーション記録があれば結論ノードのゲージ直下に「なぜこの値か」を併記する。 */
  calibration?: ConfidenceCalibrationView;
  /**
   * 調査ステップ（AI 調査ノードのホバー台帳が「この調査に登場したエージェント」を導出する材料）。
   * 未指定でも台帳自体はハイライト無しで出せる。
   */
  steps?: readonly InvestigationStepView[];
  className?: string;
}

/** コネクタの離散太さ（1..3）→ 高さクラス。連続スケールは使わない（fake precision 回避）。 */
const WEIGHT_CLASS: Record<1 | 2 | 3, string> = {
  1: "h-px",
  2: "h-[3px]",
  3: "h-[5px]",
};

/**
 * 証拠フローダイアグラム（タスク E8-A・報告用フルのみ）。
 * 「流入源（実測件数）→ AI 調査 → 結論（確信度）」の収束構造を図で示す。
 * 数字は全て backend 記録の実測（EvidenceFlowModel が導出）＝盛る経路が無い。
 * G1 の ⏱ 1行サマリはヘッダ右肩に吸収する（同じ数字を二度出さない）。
 * 視覚部は aria-hidden とし、読み上げは model.ariaSummary の1文で代替する。
 */
export function EvidenceFlowDiagram({
  model,
  calibration,
  steps = [],
  className,
}: EvidenceFlowDiagramProps) {
  // この調査のステップ文に登場したエージェント（実データからの決定論導出・ゼロでも壊れない）。
  const mentionedList = mentionedAgents(steps.map((s) => s.text));
  const mentioned = new Set(mentionedList.map((a) => a.name));
  return (
    <section
      aria-label="証拠の流れ"
      className={cn(
        "space-y-3 rounded-lg bg-slate-800/30 p-3 ring-1 ring-inset ring-slate-700/50",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          証拠の流れ
        </h4>
        <p className="text-xs text-cyan-100">
          <span aria-hidden>⏱ </span>
          <span className="font-semibold text-cyan-300">
            {model.elapsedLabel}
          </span>
          ・証拠{" "}
          <span className="font-semibold text-cyan-300">
            {model.evidenceTotal} 件
          </span>
          を収集
        </p>
      </div>
      <p className="sr-only">{model.ariaSummary}</p>
      {/* 台帳ツールチップは視覚部（aria-hidden）内のため、読み上げにはこの1行で代替する。 */}
      {mentionedList.length > 0 && (
        <p className="sr-only">
          この調査のステップに登場したエージェント:{" "}
          {mentionedList.map((a) => a.label).join("・")}
        </p>
      )}

      <div
        aria-hidden
        className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-0"
      >
        {/* 流入源（実測件数つき・0件のソースは model 側で除外済み） */}
        <ul className="min-w-0 flex-1 space-y-1.5">
          {model.sources.map((source) => (
            <li key={source.key} className="flex items-center">
              <span className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-slate-800/60 px-2.5 py-1.5 text-xs ring-1 ring-inset ring-slate-700/60">
                <span className="shrink-0 text-cyan-300">{source.icon}</span>
                <span className="truncate text-slate-200">{source.label}</span>
                <span className="ml-auto shrink-0 font-semibold tabular-nums text-cyan-300">
                  {source.count}件
                </span>
              </span>
              {/* コネクタ: 太さ＝件数の離散段階（多いソースほど太い流れ） */}
              <span
                className={cn(
                  "hidden w-6 shrink-0 rounded-full bg-cyan-500/50 md:block",
                  WEIGHT_CLASS[source.weight],
                )}
              />
            </li>
          ))}
        </ul>

        <span className="text-center text-cyan-500/70 md:hidden">▼</span>

        {/* AI 調査ノード（収束点）。ホバー/フォーカスで8エージェント台帳を出す
            （常時表示は図の邪魔＝要求時にだけ・D2 の段階開示と同方針）。 */}
        <div className="group relative shrink-0 self-center rounded-lg bg-cyan-500/10 px-4 py-3 text-center ring-1 ring-inset ring-cyan-500/30">
          <p className="text-sm font-semibold text-cyan-200">AI 調査</p>
          <p
            tabIndex={0}
            className="mt-0.5 cursor-help text-xs text-cyan-100/80 underline decoration-dotted decoration-cyan-400/50 underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
          >
            8エージェントが
            <br className="hidden md:block" />
            横断・突合
          </p>
          <div
            role="tooltip"
            className="pointer-events-none invisible absolute left-1/2 top-full z-10 mt-2 w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-left opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              エージェント台帳
              {mentioned.size > 0 && "（✓＝この調査のステップに登場）"}
            </p>
            <ul className="mt-1.5 space-y-1">
              {INVESTIGATION_AGENTS.map((agent) => {
                const active = mentioned.has(agent.name);
                return (
                  <li
                    key={agent.name}
                    data-mentioned={active}
                    className={cn(
                      "flex gap-1.5 text-xs leading-snug",
                      active ? "text-cyan-200" : "text-slate-400",
                    )}
                  >
                    <span aria-hidden className="w-3 shrink-0 text-center">
                      {active ? "✓" : "·"}
                    </span>
                    <span>
                      <span className="font-semibold">{agent.label}</span> —{" "}
                      {agent.role}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <span className="text-center text-cyan-500/70 md:hidden">▼</span>
        <span className="hidden shrink-0 px-1.5 text-cyan-500/70 md:block">
          ▶
        </span>

        {/* 結論ノード（確信度＝キャリブレーション済みの記録値） */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 self-center rounded-lg bg-slate-800/50 px-4 py-3 ring-1 ring-inset ring-slate-700/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            結論に収束
          </p>
          <ConfidenceGauge
            confidence={model.confidence}
            size="sm"
            label="AI 確信度"
            color={confidenceBrandColor(model.confidence)}
          />
          {calibration && (
            <ConfidenceCalibrationNote
              calibration={calibration}
              confidence={model.confidence}
            />
          )}
        </div>
      </div>
    </section>
  );
}
