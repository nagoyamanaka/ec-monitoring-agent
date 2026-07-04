import { cn } from "@shared/ui/cn";
import { type AlertView } from "../../domain/AlertView";
import { InvestigationItem } from "./InvestigationItem";
import { InvestigationTimeline } from "./InvestigationTimeline";
import { ImpactPanel, FaultBadge } from "./ImpactPanel";
import { EscalationPanel } from "./EscalationPanel";
import { EvidenceFlowDiagram } from "./EvidenceFlowDiagram";
import { RemediationReviewPanel } from "./RemediationReviewPanel";
import { alertReason } from "../../domain/alertReason";
import { workloadSummary } from "../../domain/investigationWorkload";
import { evidenceFlowModel } from "../../domain/evidenceFlow";

/**
 * 表示の射影モード（タスク37：同一 InvestigationReport を射影違いで出し分ける）。
 * - "summary"（一覧オーバレイ/ドロワー）: トリアージ用要約。重い証跡（調査ステップ全文・推奨アクション・
 *   impact 全項目・escalation 草案・review）は載せず、原因候補＋障害規模(impact.scale)だけに絞る。
 * - "full"（詳細ページ）: 報告用フル。impact 全項目・escalation・review まで全表示する。
 * データは二重持ちせず、同じ AlertView から表示時に射影する。
 */
export type AlertReportVariant = "summary" | "full";

export interface AlertCardExpandedProps {
  alert: AlertView;
  /**
   * 表示する射影。既定は要約（一覧オーバレイ/ドロワー）。詳細ページは "full" を渡し報告用フルを出す。
   */
  variant?: AlertReportVariant;
  /**
   * ANALYZING 中の告知（バナー/プレースホルダ）を本コンポーネントが出すか。
   * 調査パイプラインビュー（InvestigationPipelinePanel・E1）を隣にマウントする親は
   * false を渡して二重告知を避ける。既定 true（単体使用時の従来挙動）。
   */
  analyzingNotice?: boolean;
  className?: string;
}

/** 一致条件の値を表示用に整形（文字列はそのまま、非整数は2桁に丸め、それ以外は JSON 表記）。 */
function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && !Number.isInteger(value)) {
    return value.toFixed(2);
  }
  return JSON.stringify(value);
}

/**
 * Alert の展開ビュー（詳細ドロワー本体／詳細ページで共用）。
 * 既知パターン（classification の根拠）と AI 調査（summary/steps/actions）の両方を扱い、
 * 「何が・なぜ」を必ず提示する。承認/却下は feedback ベースで既知・未知を統一して扱う。
 */
export function AlertCardExpanded({
  alert,
  variant = "summary",
  analyzingNotice = true,
  className,
}: AlertCardExpandedProps) {
  const full = variant === "full";
  const report = alert.report;
  const reason = alertReason(alert);
  const known = alert.classification.type === "known";
  // 働きの明細（タスク G1）: 実測メトリクスがあれば冒頭 1 行に数字で出す（fallback は対象外）。
  const workload = report && !report.isFallback ? workloadSummary(report.metrics) : null;
  // 証拠フローダイアグラム（タスク E8-A・full のみ）。図が描けるときは ⏱ 1行を図に吸収する
  //（同じ実測を二度出さない）。描けない条件（旧データ・fallback・証拠0件）はテキスト1行へ劣化。
  const flow = full ? evidenceFlowModel(report) : null;
  // 状態が ANALYZING に戻っている＝AI が（再）調査中。既存の内容を持つときは再調査の最中。
  const analyzingNow = alert.status === "ANALYZING";

  // 分析中（既知でもなく調査レポートも無い＝初回調査）はプレースホルダ
  // （パイプラインビューが隣にある親では出さない＝他に出せる内容も無いので null）。
  if (reason.kind === "analyzing" && !report && !known) {
    if (!analyzingNotice) return null;
    return (
      <div className={cn("text-sm text-slate-300", className)}>
        AI が未知障害を調査中です…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-sm text-slate-200",
        // 報告用フルはセクション間の視覚リズムを広めに取る（タスク E8-E・密度の緩和）。
        full ? "space-y-5" : "space-y-4",
        className,
      )}
    >
      {/* AI 調査中（オンデマンドのレポート生成 or 人間の指摘を反映した再調査）。
          既存内容は下に残したまま、進行中であることを明示する。 */}
      {analyzingNow && analyzingNotice && (
        <div className="flex items-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2.5 text-sm font-medium text-cyan-200 ring-1 ring-inset ring-cyan-500/30">
          <span
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400"
            aria-hidden
          />
          AI が調査中です… 完了すると原因候補と AI レポートが表示されます
        </div>
      )}

      {/* 推定原因（該当パターン / AI 推定パターン）。
          結晶化パターンは人間語＋◈で出し、生ID（PROMOTED_...）は詳細の従属行へ降格。 */}
      {reason.kind !== "analyzing" && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            {known ? "該当パターン（既知）" : "AI 推定パターン"}
          </h4>
          {reason.kind === "known" && reason.crystallized ? (
            <>
              <p className="text-slate-100">
                <span aria-hidden className="text-emerald-300">
                  ◈{" "}
                </span>
                {reason.patternName}
                <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/25">
                  結晶化（承認により学習）
                </span>
              </p>
              <p className="text-xs text-slate-400">
                パターンID: <code>{reason.rawPatternName}</code>
              </p>
            </>
          ) : (
            <p className="text-slate-100">{reason.patternName}</p>
          )}
          {/* 学習ループの経済性の対比（タスク G1）: 既知一致は AI を起動せず即・無料で確定する事実を
              毎回 1 行で想起させる（AI 調査の実測サマリと対になる）。 */}
          {reason.kind === "known" && (
            <p className="text-xs text-emerald-300/90">
              <span aria-hidden>⚡ </span>
              既知パターン一致＝
              <span className="font-semibold">1秒未満・AI コストゼロ</span>
              で確定
              {reason.crystallized && "（初回 AI 調査の結晶化を再利用）"}
            </p>
          )}
          {/* 判断材料のヒーロー行（タスク E8-C）: 自責/他責と障害規模を報告書の冒頭へ昇格
              ＝開いて5秒で「誰の責任で・どの規模か」が揃う。詳細（影響範囲・主体・引用）は
              下の影響評価パネルが担う（重複を許すのは fault/scale の2項目のみ）。 */}
          {full && report?.impact && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-xs">
              <FaultBadge fault={report.impact.fault} />
              <span className="font-medium uppercase tracking-wide text-slate-400">
                障害規模
              </span>
              <span className="text-slate-200">{report.impact.scale}</span>
            </p>
          )}
          {/* 類似既知（SIMILARITY）の back-link は RelatedAlertsPanel の「過去の同型事例」
              セクションに確度チップ付きで提示する（ドロワー/詳細でマウント・タスク9e）。 */}
        </section>
      )}

      {/* 既知パターンの一致根拠（なぜそう判断したか） */}
      {alert.classification.type === "known" &&
        alert.classification.matchedConditions.length > 0 && (
          <section className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              一致した根拠
            </h4>
            <div className="inline-block max-w-full overflow-x-auto rounded-md ring-1 ring-inset ring-slate-700/60">
              <table className="text-left text-xs">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-300">
                    <th className="px-3 py-1.5 font-medium">項目</th>
                    <th className="px-3 py-1.5 font-medium">期待値</th>
                    <th className="px-3 py-1.5 font-medium">実値</th>
                  </tr>
                </thead>
                <tbody>
                  {alert.classification.matchedConditions.map((c, i) => (
                    <tr key={i} className="border-t border-slate-700/50">
                      <td className="px-3 py-1.5">
                        <code className="text-cyan-300">{c.field}</code>
                      </td>
                      <td className="px-3 py-1.5 text-slate-300">
                        {formatValue(c.expectedValue)}
                      </td>
                      <td className="px-3 py-1.5 text-slate-100">
                        {formatValue(c.actualValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {/* AI 調査レポート（未知パターン）。summary は要約（原因候補＋障害規模）のみ、
          full は報告用フル（調査ステップ・推奨アクション・影響評価・escalation・review）。 */}
      {report && (
        <>
          {/* 働きの明細（タスク G1）: 何秒で・どのソースを横断し・何件の証拠を読んだかの実測 1 行。
              数字は全て backend が記録した事実（InvestigationMetrics）＝人間換算はしない。
              full で証拠フローダイアグラム（E8-A）が描けるときは図に吸収し、この行は出さない。 */}
          {workload && !flow && (
            <p className="rounded-md bg-cyan-500/10 px-3 py-2 text-xs leading-relaxed text-cyan-100 ring-1 ring-inset ring-cyan-500/25">
              <span aria-hidden>⏱ </span>
              <span className="font-semibold text-cyan-300">
                {workload.elapsedLabel}
              </span>
              で
              {workload.evidenceTotal > 0 ? (
                <>
                  {workload.sources.join("・")} を横断し、
                  <span className="font-semibold text-cyan-300">
                    証拠 {workload.evidenceTotal} 件
                  </span>
                  を収集して原因を推定
                </>
              ) : (
                <>調査を実行して原因を推定</>
              )}
            </p>
          )}
          {/* 行長を抑えて可読性を守る（E8-E）。summary 射影はドロワー幅（〜480px）で自然に収まる。 */}
          <p className={cn("leading-relaxed text-slate-100", full && "max-w-prose")}>
            {report.summary}
          </p>

          {/* 証拠の流れ（タスク E8-A・full のみ）: 流入源→AI 調査→結論の収束構造を実測で図示。 */}
          {flow && (
            <EvidenceFlowDiagram
              model={flow}
              calibration={report.confidenceCalibration}
              steps={report.investigationSteps}
            />
          )}

          {/* 要約: 障害規模(impact.scale)だけを1行で出す（重い impact 全項目は full のみ）。 */}
          {!full && report.impact && (
            <p className="flex items-baseline gap-2 text-xs">
              <span className="font-medium uppercase tracking-wide text-slate-400">
                障害規模
              </span>
              <span className="text-slate-200">{report.impact.scale}</span>
            </p>
          )}

          {/* fallback の調査ステップは「収集済みの証拠リンク」（buildFallbackReport が温存した
              コミット/ログへの一次情報リンク）＝行き止まりにしない（タスク E3）。要約射影でも出す。 */}
          {report.isFallback && report.investigationSteps.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                収集済みの証拠リンク
              </h4>
              <p className="text-xs text-slate-400">
                AI の結論は出せませんでしたが、調査中に収集した一次情報へのリンクは残っています。
              </p>
              <ul className="list-disc space-y-1 pl-5 marker:text-slate-400">
                {report.investigationSteps.map((step, i) => (
                  <li key={i}>
                    <InvestigationItem item={step} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 「どうする」（推奨アクション）を根拠の直後・調査の道筋より先に置く（タスク E8-C:
              読む順でなく判断する順）。 */}
          {full && report.suggestedActions.length > 0 && (
            <section className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  推奨アクション
                </h4>
                {/* AI が「コードで直せる」と判定した場合のみ提示。remediate 実行の判断材料。 */}
                {report.remediable && (
                  <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
                    コードで修正可能（AI 判定）
                  </span>
                )}
              </div>
              <ul className="list-disc space-y-1 pl-5 marker:text-cyan-500/70">
                {report.suggestedActions.map((action, i) => (
                  <li key={i}>
                    <InvestigationItem item={action} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 調査ステップは縦タイムライン（タスク E8-B）＝AI がたどった道筋を構造で見せる。 */}
          {full && !report.isFallback && report.investigationSteps.length > 0 && (
            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                調査ステップ
              </h4>
              <InvestigationTimeline steps={report.investigationSteps} />
            </section>
          )}

          {/* 報告用フル（詳細ページのみ）: 影響評価・エスカレーション草案・修正PRレビュー。
              いずれも optional ＝ 未生成 Alert・自責ルート・PR 未起票では描画しない。 */}
          {full && report.impact && <ImpactPanel impact={report.impact} />}
          {full && report.escalation && (
            <EscalationPanel escalation={report.escalation} />
          )}
          {full && report.remediationReview && (
            <RemediationReviewPanel review={report.remediationReview} />
          )}
        </>
      )}
    </div>
  );
}
