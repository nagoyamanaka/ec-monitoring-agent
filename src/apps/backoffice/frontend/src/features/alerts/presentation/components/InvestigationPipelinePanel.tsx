import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@shared/ui/cn";
import { formatTimeJa } from "@shared/format/dateTime";
import { type AlertView, isAnalyzing } from "../../domain/AlertView";
import {
  INVESTIGATION_AGENTS,
  agentLabel,
  currentAgentName,
  progressForRun,
  toolMeta,
  type InvestigationProgressView,
} from "../../domain/investigationProgress";
import { InvestigationItem } from "./InvestigationItem";

export interface InvestigationPipelinePanelProps {
  alert: AlertView;
  /** SSE で届いた当該 Alert の調査進行イベント（時系列・実イベントのみ）。 */
  progress?: readonly InvestigationProgressView[];
  /**
   * ANALYZING→完了 をライブで見届けたとき、調査ステップをタイムラインとして順次アニメ表示するか。
   * 詳細ページは full 射影に調査ステップの全文があるため off にする（重複回避）。
   */
  showCompletionTimeline?: boolean;
  className?: string;
}

/** 経過秒 → "m:ss"。負値（時計ずれ）は 0:00 に丸める。 */
function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 1 秒ごとに現在時刻を返す ticker（active=false なら止める）。 */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * AI 調査ライブ・タイムライン（タスク E1・最大の wow）。
 *
 * ANALYZING 中: 経過時間タイマー（実測）＋不確定プログレス＋8エージェント台帳＋
 * SSE "investigation-progress" の実行イベントをライブ表示する。表示するのは
 * **システムが実際に観測したイベントのみ**（演出の捏造はしない）。イベントが無い経路
 * （単一 Gemini／中継前）でも台帳とタイマーで「何が動いているか」を伝える。
 *
 * 完了時: このパネルの生存中に ANALYZING→レポート添付 を見届けた場合のみ、確定した
 * InvestigationReport の調査ステップをタイムラインとして順次アニメ表示する（実データのみ）。
 * 進行イベントは run の切り分けを alert.updatedAt（ANALYZING 遷移時に更新される）で行う。
 */
export function InvestigationPipelinePanel({
  alert,
  progress = [],
  showCompletionTimeline = true,
  className,
}: InvestigationPipelinePanelProps) {
  const analyzing = isAnalyzing(alert);

  // ANALYZING の開始時刻は「ANALYZING 中に最後に保存された時刻」＝updatedAt を使う。
  // ただし進行イベントの run 切り分けにも同じ値を使うため、analyzing の間だけ固定で保持する
  // （dedup 等で updatedAt が動いてもタイマーが巻き戻らないよう最初に観測した値を使う）。
  const runStartRef = useRef<string | null>(null);
  if (analyzing && runStartRef.current === null) {
    runStartRef.current = alert.updatedAt;
  }
  if (!analyzing && runStartRef.current !== null && !alert.report) {
    runStartRef.current = null;
  }
  const runStartedAt = runStartRef.current ?? alert.updatedAt;

  // ライブで完了を見届けたか（見届けたときだけ完了タイムラインを流す＝開き直しでは流さない）。
  const [sawAnalyzing, setSawAnalyzing] = useState(analyzing);
  useEffect(() => {
    if (analyzing) setSawAnalyzing(true);
  }, [analyzing]);

  const now = useNow(analyzing);

  // 今回の run に属する実行イベントだけを表示する（再調査の古い run を混ぜない）。
  const runEvents = useMemo(
    () => progressForRun(progress, runStartedAt),
    [progress, runStartedAt],
  );
  const latest = runEvents[runEvents.length - 1];
  // 「実行中」は最新イベントの実行主体1名だけ（委譲イベントは委譲先）。
  const currentAgent = currentAgentName(latest);
  // 台帳のハイライト: イベントに登場した（呼んだ or 委譲された）エージェント＝稼働済み。
  const activeAgents = useMemo(() => {
    const names = new Set<string>();
    for (const e of runEvents) {
      names.add(e.agent);
      names.add(e.tool); // AgentTool 委譲は tool 側がエージェント名
    }
    return names;
  }, [runEvents]);

  if (analyzing) {
    const elapsedSec = (now - new Date(runStartedAt).getTime()) / 1000;
    return (
      <section
        className={cn(
          "space-y-3 rounded-tremor-default bg-cyan-500/5 px-4 py-3 ring-1 ring-inset ring-cyan-500/25",
          className,
        )}
        aria-label="AI 調査パイプライン"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400"
          />
          <h4 className="text-sm font-semibold text-cyan-200">
            AI エージェントが自律調査中
          </h4>
          <span
            className="ml-auto font-mono text-sm tabular-nums text-cyan-300"
            title="調査開始からの実測経過時間"
          >
            経過 {formatElapsed(elapsedSec)}
          </span>
        </div>

        {/* 不確定プログレス（完了時刻は約束しない＝正直に「進行中」だけを伝える）。 */}
        <div
          role="progressbar"
          aria-label="調査進行中（完了時刻は未確定）"
          className="pipeline-track relative h-1 overflow-hidden rounded-full bg-slate-700/60"
        >
          <span aria-hidden className="pipeline-sweep absolute inset-y-0 w-2/5 rounded-full bg-cyan-400/70" />
        </div>

        {/* 8エージェント台帳: 誰が何の係か＋実イベントに登場したかを示す。 */}
        <ul className="space-y-1">
          {INVESTIGATION_AGENTS.map((agent) => {
            const isCurrent = currentAgent === agent.name;
            const wasActive = activeAgents.has(agent.name);
            return (
              <li
                key={agent.name}
                className={cn(
                  "flex items-baseline gap-2 rounded px-2 py-1 text-xs transition",
                  isCurrent
                    ? "bg-cyan-500/10 text-cyan-200 ring-1 ring-inset ring-cyan-500/30"
                    : wasActive
                      ? "text-slate-200"
                      : "text-slate-400",
                )}
              >
                <span aria-hidden className="w-3 shrink-0 text-center">
                  {isCurrent ? "▸" : wasActive ? "✓" : "·"}
                </span>
                <span className="shrink-0 font-semibold">{agent.label}</span>
                <span className="min-w-0 truncate">{agent.role}</span>
                {isCurrent && (
                  <span className="ml-auto shrink-0 font-medium">実行中</span>
                )}
              </li>
            );
          })}
        </ul>

        {/* 実行イベントのライブフィード（直近5件・実イベントのみ）。 */}
        {runEvents.length > 0 && (
          <ol className="space-y-1 border-t border-cyan-500/15 pt-2" aria-label="実行イベント">
            {runEvents.slice(-5).map((e, i) => {
              const tool = toolMeta(e.tool);
              return (
                <li
                  key={`${e.at}-${e.agent}-${e.tool}-${i}`}
                  className="evidence-rise flex items-center gap-2 text-xs text-slate-300"
                >
                  <span aria-hidden className="text-cyan-300">
                    {tool.icon}
                  </span>
                  <span className="font-medium text-slate-200">
                    {agentLabel(e.agent)}
                  </span>
                  <span className="min-w-0 truncate">{tool.label}</span>
                  <span className="ml-auto shrink-0 text-slate-500">
                    {formatTimeJa(e.at)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-[11px] leading-relaxed text-slate-400">
          表示は実際のエージェント実行イベントのみ（実測 およそ
          2 分前後）。調査ステップの内容はレポート完成時に確定します。
        </p>
      </section>
    );
  }

  // ライブで完了を見届けたときだけ、確定した調査ステップをタイムラインとして流す。
  const steps = alert.report?.investigationSteps ?? [];
  if (!showCompletionTimeline || !sawAnalyzing || steps.length === 0) {
    return null;
  }
  return (
    <section
      className={cn(
        "space-y-2 rounded-tremor-default bg-slate-800/30 px-4 py-3 ring-1 ring-inset ring-slate-700/60",
        className,
      )}
      aria-label="AI 調査タイムライン"
    >
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        <span aria-hidden className="text-emerald-300">
          ✓
        </span>
        調査完了 — AI がたどったステップ
      </h4>
      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li
            key={i}
            className="evidence-rise flex items-baseline gap-2 text-xs text-slate-200"
            style={{ animationDelay: `${i * 0.25}s` }}
          >
            <span
              aria-hidden
              className="w-4 shrink-0 text-right font-mono text-slate-500"
            >
              {i + 1}
            </span>
            <InvestigationItem item={step} />
          </li>
        ))}
      </ol>
    </section>
  );
}
