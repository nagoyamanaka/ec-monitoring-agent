import { cn } from "@shared/ui/cn";
import {
  ArrowUpRightIcon,
  ClockIcon,
  DiamondIcon,
  MonitorIcon,
  ScaleIcon,
  ZapIcon,
} from "@shared/ui/icons";
import { type AlertView } from "../../domain/AlertView";
import { InvestigationItem } from "./InvestigationItem";
import { InvestigationTimeline } from "./InvestigationTimeline";
import { ImpactPanel, FaultBadge } from "./ImpactPanel";
import { EscalationPanel } from "./EscalationPanel";
import { EvidenceFlowDiagram } from "./EvidenceFlowDiagram";
import { RemediationReviewPanel } from "./RemediationReviewPanel";
import { NextActionCard } from "./NextActionCard";
import { alertReason } from "../../domain/alertReason";
import { patternLabel } from "../../domain/patternLabel";
import { nextAction } from "../../domain/nextAction";
import {
  documentationRows,
  isCloudMonitoringAutoSummary,
  parseResourceName,
} from "../../domain/DetectionDetailView";
import { classificationEvidence } from "../../domain/classificationEvidence";
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
  // 「次のアクション」（対応フェーズの行動指示・タスク U6）: 他責＝暫定回避手順、既知/類似＝
  // 当時の対応をなぞる。自責は既存の「推奨アクション」ブロックが担うため null（二重表示しない）。
  const next = nextAction(alert);
  // 分類根拠の表示射影: 等価一致は1つの値に畳み、similarity の条件式はゲートとして分離する。
  const evidence = known
    ? classificationEvidence(alert.classification.matchedConditions)
    : null;
  // 働きの明細（タスク G1）: 実測メトリクスがあれば冒頭 1 行に数字で出す（fallback は対象外）。
  const workload = report && !report.isFallback ? workloadSummary(report.metrics) : null;
  // 証拠フローダイアグラム（タスク E8-A・full のみ）。図が描けるときは ⏱ 1行を図に吸収する
  //（同じ実測を二度出さない）。描けない条件（旧データ・fallback・証拠0件）はテキスト1行へ劣化。
  // Trivy CVE（検知 payload 実測）も流入源として渡す（SECURITY では確信度を支える主証拠）。
  const flow = full
    ? evidenceFlowModel(report, alert.securityFindings.length)
    : null;
  // 状態が ANALYZING に戻っている＝AI が（再）調査中。既存の内容を持つときは再調査の最中。
  const analyzingNow = alert.status === "ANALYZING";
  // 発報内容の表示射影（可読性・タスク E 系）: documentation が「ラベル: 値」行構成なら
  // 定義リストへ構造化し、CM 自動生成の英文 summary（documentation と全重複の機械文）は
  // 原文 details へ降格、「Type labels {k=v,…}」形の resourceName はラベルチップへ分解する。
  const detection = alert.detectionDetail;
  const docRows = detection?.documentation
    ? documentationRows(detection.documentation)
    : null;
  const logRow = docRows?.find((row) => row.label === "検知ログ") ?? null;
  const docMetaRows = docRows?.filter((row) => row.label !== "検知ログ") ?? [];
  const detectionResource = detection?.resourceName
    ? parseResourceName(detection.resourceName)
    : null;
  // 降格は documentation が語りを担えるときだけ（自動英文しか無い Alert では唯一の説明を消さない）。
  const rawSummaryDemoted =
    detection?.summary != null &&
    docRows != null &&
    isCloudMonitoringAutoSummary(detection.summary);

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
        <div className="flex items-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2.5 text-sm font-medium text-cyan-200">
          <span
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400"
            aria-hidden
          />
          AI が調査中です… 完了すると原因候補と AI レポートが表示されます
        </div>
      )}

      {/* 発報内容（検知ソースの生情報）。eventName は dedup/分類キーで「何が・どこで起きたか」を
          運べないため、ingest が payload に格納した summary・検知ログ（documentation）・対象リソースを
          分類より先に出す＝「何が起きたか」→「どう分類したか」の読み順。EC 業務イベント等
          該当フィールドを持たない Alert では出ない。 */}
      {detection && (
        <section className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-300">
            発報内容
          </h4>
          {/* リード文（人間語 summary）。CM 自動生成の英文は下の details（原文）へ降格済み。 */}
          {detection.summary && !rawSummaryDemoted && (
            <p className="text-sm leading-relaxed text-slate-100">
              {detection.summary}
            </p>
          )}
          {/* ポリシー documentation ＝ label_extractors が抜いた検知ログの中身。
              「ラベル: 値」の行構成なら検知ログを主役の引用に・残りを定義リストに構造化し、
              形が違う documentation は従来どおり改行保持の生テキストで出す。 */}
          {docRows ? (
            <div className="rounded-md bg-slate-800/60 px-3.5 py-3">
              {logRow && (
                <div className="border-l-2 border-cyan-500/50 pl-2.5">
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    検知ログ
                  </p>
                  <p className="text-sm leading-relaxed text-slate-100">
                    {logRow.value}
                  </p>
                </div>
              )}
              {docMetaRows.length > 0 && (
                <dl
                  className={cn(
                    "space-y-1.5 text-xs",
                    // 引用（何が起きたか）とメタ行（どこで・何の条件で）のグループ境界を
                    // 細い区切り線で示す＝行間を増やさず塊の切れ目だけ作る。
                    logRow && "mt-2.5 border-t border-slate-700/40 pt-2.5",
                  )}
                >
                  {docMetaRows.map((row) => (
                    <div key={row.label} className="flex gap-2">
                      <dt className="min-w-[6em] shrink-0 text-slate-400">
                        {row.label}
                      </dt>
                      <dd className="leading-relaxed text-slate-200">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ) : (
            detection.documentation && (
              <p className="whitespace-pre-line rounded-md bg-slate-800/60 px-3 py-2 text-xs leading-relaxed text-slate-200">
                {detection.documentation}
              </p>
            )
          )}
          {(detection.resourceName ||
            detection.policyName ||
            detection.metricType) && (
            <div className="space-y-1.5 pt-0.5 text-xs text-slate-400">
              <p className="flex flex-wrap gap-x-4 gap-y-0.5">
                {detection.resourceName && (
                  <span>
                    対象リソース:{" "}
                    <code className="text-slate-200">
                      {detectionResource
                        ? detectionResource.descriptor
                        : detection.resourceName}
                    </code>
                    {detection.resourceType && (
                      <span className="ml-1 text-slate-400">
                        ({detection.resourceType})
                      </span>
                    )}
                  </span>
                )}
                {detection.policyName && (
                  <span>
                    発報ポリシー:{" "}
                    <span className="text-slate-200">
                      {detection.policyName}
                    </span>
                  </span>
                )}
                {detection.metricType && (
                  <span>
                    メトリクス:{" "}
                    <code className="text-slate-200">
                      {detection.metricType}
                    </code>
                  </span>
                )}
              </p>
              {/* 「Type labels {k=v,…}」の生 blob はチップに分解（実発報のみこの形で届く）。 */}
              {detectionResource && (
                <p className="flex flex-wrap gap-1.5">
                  {detectionResource.labels.map((label) => (
                    <code
                      key={label.key}
                      className="rounded-md bg-slate-800/70 px-1.5 py-0.5 text-[10px] text-slate-300"
                    >
                      {label.key}={label.value}
                    </code>
                  ))}
                </p>
              )}
            </div>
          )}
          {/* 降格した CM 自動生成サマリの原文（透明性のため捨てずに畳んで残す）。 */}
          {rawSummaryDemoted && detection.summary && (
            <details className="text-xs">
              <summary className="cursor-pointer select-none text-slate-400 transition hover:text-slate-300">
                Cloud Monitoring 原文サマリ（自動生成の英文）
              </summary>
              <p className="mt-1 break-all rounded-md bg-slate-800/40 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-slate-400">
                {detection.summary}
              </p>
            </details>
          )}
          {/* CM インシデントのコンソールリンクは実発報にしか無い（合成は偽リンクを作らない）。 */}
          {detection.incidentUrl && (
            <a
              href={detection.incidentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 transition hover:text-cyan-200 hover:decoration-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <MonitorIcon className="shrink-0" />
              <span>Cloud Monitoring インシデントを開く</span>
              <ArrowUpRightIcon className="shrink-0 text-cyan-500/70" />
            </a>
          )}
        </section>
      )}

      {/* 推定原因（該当パターン / 原因候補=AI推定）。
          結晶化パターンは人間語＋◈で出し、生ID（PROMOTED_...）は詳細の従属行へ降格。
          それ以外も patternLabel（G4）で人間語化し、写像が起きたときだけ生IDを従属行へ残す。 */}
      {reason.kind !== "analyzing" && (
        <section className="space-y-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-300">
            {known ? "該当パターン（既知）" : "原因候補（AI 推定）"}
          </h4>
          {reason.kind === "known" && reason.crystallized ? (
            <>
              <p className="text-slate-100">
                <DiamondIcon className="mr-1 inline-block align-[-0.125em] text-emerald-300" />
                {reason.patternName}
                <span className="ml-2 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
                  結晶化（承認により学習）
                </span>
              </p>
              <p className="text-xs text-slate-400">
                パターンID: <code>{reason.rawPatternName}</code>
              </p>
            </>
          ) : patternLabel(reason.patternName) !== reason.patternName ? (
            <>
              <p className="text-slate-100">{patternLabel(reason.patternName)}</p>
              <p className="text-xs text-slate-400">
                パターンID: <code>{reason.patternName}</code>
              </p>
            </>
          ) : (
            <p className="text-slate-100">{reason.patternName}</p>
          )}
          {/* 何が原因だったか（G4b）: 既知はパターン名だけでは原因を語らないため、
              seed の定義文 or 結晶化の承認時 AI summary を1行で添える。
              類似（SIMILARITY）は確定でないため候補調。 */}
          {reason.kind === "known" && reason.cause !== undefined && (
            <p className="text-slate-300">
              <span className="text-slate-400">
                {reason.source === "EXACT_MATCH" ? "原因: " : "原因候補: "}
              </span>
              {reason.cause}
            </p>
          )}
          {/* 学習ループの経済性の対比（タスク G1）: 既知一致は AI を起動せず即・無料で確定する事実を
              毎回 1 行で想起させる（AI 調査の実測サマリと対になる）。 */}
          {reason.kind === "known" && (
            <p className="text-xs text-emerald-300/90">
              <ZapIcon className="mr-1 inline-block align-[-0.125em]" />
              既知パターン一致＝
              <span className="font-medium">1秒未満・AI コストゼロ</span>
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

      {/* 既知パターンの一致根拠（なぜそう判断したか）。
          一致済みの条件は期待値=実値なので同じ値を2カラムに重複させず1つに畳む（E系: 認知負荷）。
          similarity のしきい値は「一致」でなく確定の条件式＝テーブルに混ぜずゲート行で見せる。 */}
      {evidence && (evidence.rows.length > 0 || evidence.similarityGate) && (
        <section className="space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-300">
            一致した根拠
          </h4>
          {/* 根拠は実質 1〜2 行なのでヘッダ付きテーブルは器が重い。
              「ラベル ＋ 生フィールド名 → ✓ 一致値」の key-value 行に畳む。 */}
          {evidence.rows.length > 0 && (
            <ul className="max-w-full rounded-md bg-slate-800/40 px-3 py-2 text-xs">
              {evidence.rows.map((row, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 py-0.5"
                >
                  <span className="text-slate-400">{row.label}</span>
                  {row.raw && (
                    <code className="text-[10px] text-slate-400">
                      {row.raw}
                    </code>
                  )}
                  <span aria-hidden className="text-emerald-300">
                    ✓
                  </span>
                  <span className="text-slate-100">{row.value}</span>
                  {row.expected && (
                    <span className="w-full pl-4 text-slate-400">
                      照合相手（期待値）: {row.expected}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* 確定の判断ルール（決定論のしきい値ゲート）を条件式のまま可視化する。
              値は上部 donut と同じ百分率語彙。下回った場合の行き先（AI 調査）も明示。 */}
          {evidence.similarityGate && (
            <p className="text-xs leading-relaxed text-slate-300">
              <ScaleIcon className="mr-1 inline-block align-[-0.125em]" />
              確定条件: 類似度
              <code className="mx-1 text-[10px] text-slate-400">
                {evidence.similarityGate.raw}
              </code>
              <span className="font-medium text-emerald-300">
                {evidence.similarityGate.actualLabel}
              </span>{" "}
              ≧ しきい値 {evidence.similarityGate.thresholdLabel}{" "}
              を満たしたため準・既知に自動分類（下回る場合は AI 調査へフォールバック）
            </p>
          )}
        </section>
      )}

      {/* 次のアクション（既知/類似ルート）: AI 調査を起動しない既知は「結論＝該当パターン」の
          直後に、過去/類似事例 or 既知パターンの対応（resolvedNote）を行動指示として昇格する。
          他責（report あり）ルートはレポート本体側の結論直後に別配置する（origin で出し分け）。 */}
      {next?.origin === "memory" && <NextActionCard next={next} />}

      {/* AI 調査レポート（未知パターン）。summary は要約（原因候補＋障害規模）のみ、
          full は報告用フル（調査ステップ・推奨アクション・影響評価・escalation・review）。 */}
      {report && (
        <>
          {/* 働きの明細（タスク G1）: 何秒で・どのソースを横断し・何件の証拠を読んだかの実測 1 行。
              数字は全て backend が記録した事実（InvestigationMetrics）＝人間換算はしない。
              full で証拠フローダイアグラム（E8-A）が描けるときは図に吸収し、この行は出さない。 */}
          {workload && !flow && (
            <p className="rounded-md bg-slate-800/40 px-3 py-2 text-xs leading-relaxed text-slate-400">
              <ClockIcon className="mr-1 inline-block align-[-0.125em]" />
              <span className="font-medium text-slate-200">
                {workload.elapsedLabel}
              </span>
              で
              {workload.evidenceTotal > 0 ? (
                <>
                  {workload.sources.join("・")} を横断し、
                  <span className="font-medium text-slate-200">
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
              <h4 className="text-xs font-medium uppercase tracking-wide text-slate-300">
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

          {/* 次のアクション（タスク U6）: 結論（証拠の流れ／要約）の直後に「で、次にこれをやる」を出す。
              自責＝推奨アクション手順（remediation・コード修正可能なら下の自動修正へ橋渡し）、
              他責＝暫定回避手順（escalation・宛先/理由/根拠は下の EscalationPanel に従属）。origin で排他。
              予兆の「今打てる先手」と対の視覚言語で全ルート共通の顔にする。
              **要約（ドロワー）でも出す**＝「次に何をやるか」はトリアージそのもの（memory と同じく非 full）。
              重い草案本体（宛先/影響全項目/レビュー）は full 限定のまま＝カードは行動指示に絞る。 */}
          {(next?.origin === "remediation" || next?.origin === "escalation") && (
            <NextActionCard next={next} />
          )}

          {/* 調査ステップは縦タイムライン（タスク E8-B）＝AI がたどった道筋を構造で見せる。 */}
          {full && !report.isFallback && report.investigationSteps.length > 0 && (
            <section className="space-y-1.5">
              <h4 className="text-xs font-medium uppercase tracking-wide text-slate-300">
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
