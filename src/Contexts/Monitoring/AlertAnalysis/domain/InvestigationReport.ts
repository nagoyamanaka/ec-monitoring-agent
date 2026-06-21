import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { ReviewStatus } from "./ReviewStatus.js";
import type { InvestigationReportPrimitives } from "./contracts/AlertContract.js";

// シリアライズ契約は contracts に一元化（backend/frontend 共通の単一ソース）。
export type { InvestigationReportPrimitives };

export class InvestigationReport {
  readonly summary: string;
  readonly confidence: number;
  readonly severity: AlertSeverity;
  readonly investigationSteps: string[];
  readonly suggestedActions: string[];
  readonly suggestedPatternName: string;
  readonly reviewStatus: ReviewStatus;
  readonly investigatedAt: Date;
  readonly isFallback: boolean;

  constructor(params: {
    summary: string;
    confidence: number;
    severity: AlertSeverity;
    investigationSteps: string[];
    suggestedActions: string[];
    suggestedPatternName: string;
    reviewStatus: ReviewStatus;
    investigatedAt: Date;
    isFallback: boolean;
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
  }

  withReviewStatus(reviewStatus: ReviewStatus): InvestigationReport {
    return new InvestigationReport({ ...this, reviewStatus });
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
    });
  }
}
