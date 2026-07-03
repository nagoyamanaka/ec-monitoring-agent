import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { ReviewStatus } from "./ReviewStatus.js";
import type {
  InvestigationReportPrimitives,
  InvestigationItemPrimitives,
  RelatedAlertPrimitives,
  ImpactAssessmentPrimitives,
  EscalationDraftPrimitives,
  RemediationReviewPrimitives,
  InvestigationMetricsPrimitives,
  InvestigationEvidenceCountsPrimitives,
  ConfidenceCalibrationPrimitives,
} from "./contracts/AlertContract.js";

// シリアライズ契約は contracts に一元化（backend/frontend 共通の単一ソース）。
export type {
  InvestigationReportPrimitives,
  InvestigationItemPrimitives,
  RelatedAlertPrimitives,
  ImpactAssessmentPrimitives,
  EscalationDraftPrimitives,
  RemediationReviewPrimitives,
  InvestigationMetricsPrimitives,
  InvestigationEvidenceCountsPrimitives,
  ConfidenceCalibrationPrimitives,
};

/** 調査ステップ／推奨アクション項目から表示・学習用のプレーンテキストを取り出す。 */
export function investigationItemText(item: InvestigationItemPrimitives): string {
  return typeof item === "string" ? item : item.text;
}

export class InvestigationReport {
  readonly summary: string;
  readonly confidence: number;
  readonly severity: AlertSeverity;
  readonly investigationSteps: InvestigationItemPrimitives[];
  readonly suggestedActions: InvestigationItemPrimitives[];
  readonly suggestedPatternName: string;
  readonly reviewStatus: ReviewStatus;
  readonly investigatedAt: Date;
  readonly isFallback: boolean;
  // AI が「コードで直せる（PR で remediate 可能）」と判定したか。UI の remediate ゲート＋
  // ROI 提示用の advisory シグナル。未指定は false（旧データ・fallback 互換）。
  readonly remediable: boolean;
  // AI 調査が見つけた相関アラート（id・関係・根拠）。未指定は空配列（旧データ・fallback 互換）。
  readonly relatedAlerts: RelatedAlertPrimitives[];
  // 影響評価（自責他責・影響範囲・障害規模）。未指定は undefined（旧データ・fallback 互換）。
  // 根拠（citations）の無い impact はマッパ側で落とすので、ここに載るのは必ず引用付き。
  readonly impact?: ImpactAssessmentPrimitives;
  // 他責/運用案件のエスカレーション草案（impact.fault=external/運用ルートの出口）。未指定は
  // undefined（旧データ・自責ルート・fallback 互換）。team の無い草案はマッパ側で落とす。
  readonly escalation?: EscalationDraftPrimitives;
  // 修正PRの自動レビュー結果（タスク36・RV段階）。未指定は undefined（旧データ・PR 未起票・
  // fallback 互換）。pullRequestUrl 空のレビューはマッパ側で落とす。
  readonly remediationReview?: RemediationReviewPrimitives;
  // Forecast 突合キー（ForecastMemory projection が解決済み事例のタグとして読む）。
  // 調査時に deterministic に導出して埋める（LLM 出力ではない）。未指定は undefined（旧データ互換）。
  readonly subject?: string;
  // 調査の実測メトリクス（経過時間・証拠件数内訳＝タスク G1）。UseCase が計測して添付する
  // （LLM 出力ではない）。未指定は undefined（旧データ・未計測互換）。
  readonly metrics?: InvestigationMetricsPrimitives;
  // 確信度キャリブレーションの記録（裏付けシグナル・上限・LLM 自己申告値）。UseCase が
  // deterministic に添付する（LLM 出力ではない）。未指定は undefined（旧データ・fallback 互換）。
  readonly confidenceCalibration?: ConfidenceCalibrationPrimitives;

  constructor(params: {
    summary: string;
    confidence: number;
    severity: AlertSeverity;
    investigationSteps: InvestigationItemPrimitives[];
    suggestedActions: InvestigationItemPrimitives[];
    suggestedPatternName: string;
    reviewStatus: ReviewStatus;
    investigatedAt: Date;
    isFallback: boolean;
    remediable?: boolean;
    relatedAlerts?: RelatedAlertPrimitives[];
    impact?: ImpactAssessmentPrimitives;
    escalation?: EscalationDraftPrimitives;
    remediationReview?: RemediationReviewPrimitives;
    subject?: string;
    metrics?: InvestigationMetricsPrimitives;
    confidenceCalibration?: ConfidenceCalibrationPrimitives;
  }) {
    this.summary = params.summary;
    this.confidence = params.confidence;
    this.severity = params.severity;
    this.investigationSteps = params.investigationSteps;
    this.suggestedActions = params.suggestedActions;
    this.suggestedPatternName = params.suggestedPatternName;
    this.reviewStatus = params.reviewStatus;
    this.investigatedAt = params.investigatedAt;
    this.isFallback = params.isFallback;
    this.remediable = params.remediable ?? false;
    this.relatedAlerts = params.relatedAlerts ?? [];
    this.impact = params.impact;
    this.escalation = params.escalation;
    this.remediationReview = params.remediationReview;
    this.subject = params.subject;
    this.metrics = params.metrics;
    this.confidenceCalibration = params.confidenceCalibration;
  }

  withReviewStatus(reviewStatus: ReviewStatus): InvestigationReport {
    return new InvestigationReport({ ...this, reviewStatus });
  }

  withSubject(subject: string): InvestigationReport {
    return new InvestigationReport({ ...this, subject });
  }

  /**
   * 確信度キャリブレーション（ConfidenceCalibration）を反映する。
   * confidence 本体を補正値（calibrated）で置き換え、根拠（signals/cap/original）を記録に残す。
   */
  withConfidenceCalibration(
    calibration: ConfidenceCalibrationPrimitives & { readonly calibrated: number },
  ): InvestigationReport {
    return new InvestigationReport({
      ...this,
      confidence: calibration.calibrated,
      confidenceCalibration: {
        signals: [...calibration.signals],
        cap: calibration.cap,
        original: calibration.original,
      },
    });
  }

  withMetrics(metrics: InvestigationMetricsPrimitives): InvestigationReport {
    return new InvestigationReport({ ...this, metrics });
  }

  toPrimitives(): InvestigationReportPrimitives {
    return {
      summary: this.summary,
      confidence: this.confidence,
      severity: this.severity.value,
      investigationSteps: [...this.investigationSteps],
      suggestedActions: [...this.suggestedActions],
      suggestedPatternName: this.suggestedPatternName,
      reviewStatus: this.reviewStatus.value,
      investigatedAt: this.investigatedAt.toISOString(),
      isFallback: this.isFallback,
      remediable: this.remediable,
      relatedAlerts: [...this.relatedAlerts],
      ...(this.impact ? { impact: this.impact } : {}),
      ...(this.escalation ? { escalation: this.escalation } : {}),
      ...(this.remediationReview ? { remediationReview: this.remediationReview } : {}),
      ...(this.subject ? { subject: this.subject } : {}),
      ...(this.metrics ? { metrics: this.metrics } : {}),
      ...(this.confidenceCalibration
        ? { confidenceCalibration: this.confidenceCalibration }
        : {}),
    };
  }

  static fromPrimitives(primitives: InvestigationReportPrimitives): InvestigationReport {
    return new InvestigationReport({
      summary: primitives.summary,
      confidence: primitives.confidence,
      severity: AlertSeverity.fromString(primitives.severity),
      investigationSteps: primitives.investigationSteps,
      suggestedActions: primitives.suggestedActions,
      suggestedPatternName: primitives.suggestedPatternName,
      reviewStatus: ReviewStatus.fromString(primitives.reviewStatus),
      investigatedAt: new Date(primitives.investigatedAt),
      isFallback: primitives.isFallback,
      remediable: primitives.remediable ?? false,
      relatedAlerts: primitives.relatedAlerts ?? [],
      impact: primitives.impact,
      escalation: primitives.escalation,
      remediationReview: primitives.remediationReview,
      subject: primitives.subject,
      metrics: primitives.metrics,
      confidenceCalibration: primitives.confidenceCalibration,
    });
  }
}
