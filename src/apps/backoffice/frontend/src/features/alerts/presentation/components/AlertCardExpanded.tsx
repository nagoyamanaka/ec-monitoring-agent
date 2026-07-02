import { cn } from "@shared/ui/cn";
import { type AlertView } from "../../domain/AlertView";
import { InvestigationItem } from "./InvestigationItem";
import { ImpactPanel } from "./ImpactPanel";
import { EscalationPanel } from "./EscalationPanel";
import { RemediationReviewPanel } from "./RemediationReviewPanel";
import { alertReason } from "../../domain/alertReason";

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
  className?: string;
}

/** 一致条件の値を表示用に整形（文字列はそのまま、それ以外は JSON 表記）。 */
function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Alert の展開ビュー（詳細ドロワー本体／詳細ページで共用）。
 * 既知パターン（classification の根拠）と AI 調査（summary/steps/actions）の両方を扱い、
 * 「何が・なぜ」を必ず提示する。承認/却下は feedback ベースで既知・未知を統一して扱う。
 */
export function AlertCardExpanded({
  alert,
  variant = "summary",
  className,
}: AlertCardExpandedProps) {
  const full = variant === "full";
  const report = alert.report;
  const reason = alertReason(alert);
  const known = alert.classification.type === "known";
  // 状態が ANALYZING に戻っている＝AI が（再）調査中。既存の内容を持つときは再調査の最中。
  const analyzingNow = alert.status === "ANALYZING";

  // 分析中（既知でもなく調査レポートも無い＝初回調査）はプレースホルダ
  if (reason.kind === "analyzing" && !report && !known) {
    return (
      <div className={cn("text-sm text-slate-300", className)}>
        AI が未知障害を調査中です…
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 text-sm text-slate-200", className)}>
      {/* AI 調査中（オンデマンドのレポート生成 or 人間の指摘を反映した再調査）。
          既存内容は下に残したまま、進行中であることを明示する。 */}
      {analyzingNow && (
        <div className="flex items-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2.5 text-sm font-medium text-cyan-200 ring-1 ring-inset ring-cyan-500/30">
          <span
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400"
            aria-hidden
          />
          AI が調査中です… 完了すると原因候補と AI レポートが表示されます
        </div>
      )}

      {/* 推定原因（該当パターン / AI 推定パターン） */}
      {reason.kind !== "analyzing" && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            {known ? "該当パターン（既知）" : "AI 推定パターン"}
          </h4>
          <p className="text-slate-100">{reason.patternName}</p>
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
          <p className="leading-relaxed text-slate-100">{report.summary}</p>

          {/* 要約: 障害規模(impact.scale)だけを1行で出す（重い impact 全項目は full のみ）。 */}
          {!full && report.impact && (
            <p className="flex items-baseline gap-2 text-xs">
              <span className="font-medium uppercase tracking-wide text-slate-400">
                障害規模
              </span>
              <span className="text-slate-200">{report.impact.scale}</span>
            </p>
          )}

          {full && report.investigationSteps.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                調査ステップ
              </h4>
              <ol className="list-decimal space-y-1 pl-5 marker:text-slate-400">
                {report.investigationSteps.map((step, i) => (
                  <li key={i}>
                    <InvestigationItem item={step} />
                  </li>
                ))}
              </ol>
            </section>
          )}

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
