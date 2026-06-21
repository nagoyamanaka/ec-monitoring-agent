import type {
  AlertPrimitives,
  AlertClassificationPrimitives,
} from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import {
  type InvestigationReportView,
  toInvestigationReportView,
} from "./InvestigationReportView";

/**
 * Alert の表示用型と、ワイヤ契約（共有 contracts の AlertPrimitives）→ View の純関数。
 * domain は型＋純関数のみ。ワイヤ形式は backend と共有する単一ソース（型のみ・ランタイム非依存）を import する。
 * 文字列値は backend の AlertStatus / AlertSeverity / MonitoringEventCategory と整合する。
 */

export type AlertStatus = "OPEN" | "ANALYZING" | "RESOLVED";
export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";
export type AlertCategory =
  | "APPLICATION"
  | "INFRASTRUCTURE"
  | "CAPACITY"
  | "SECURITY";

/** 分類結果の表示用型。未知障害（unknown）は confidence が null。 */
export type AlertClassificationView =
  | {
      readonly type: "known";
      readonly patternId: string;
      readonly patternName: string;
      readonly confidence: number;
    }
  | { readonly type: "unknown"; readonly confidence: null };

export type AlertFeedbackView = {
  readonly isCorrect: boolean;
  readonly operatorNote?: string;
};

/** 表示用に整形した Alert。一覧・カード・詳細が消費する単一の view-model。 */
export type AlertView = {
  readonly id: string;
  readonly status: AlertStatus;
  readonly severity: AlertSeverity;
  readonly category: AlertCategory;
  readonly source: string;
  readonly eventName: string;
  readonly occurredOn: string;
  readonly classification: AlertClassificationView;
  readonly report: InvestigationReportView | null;
  readonly feedback: AlertFeedbackView | null;
  readonly correctFeedbackCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toClassificationView(
  dto: AlertClassificationPrimitives,
): AlertClassificationView {
  if (dto.type === "known") {
    return {
      type: "known",
      patternId: dto.patternId,
      patternName: dto.patternName,
      confidence: dto.confidence,
    };
  }
  return { type: "unknown", confidence: null };
}

export function toAlertView(dto: AlertPrimitives): AlertView {
  return {
    id: dto.id,
    status: dto.status as AlertStatus,
    severity: dto.severity as AlertSeverity,
    category: dto.monitoringEvent.category as AlertCategory,
    source: dto.monitoringEvent.source,
    eventName: dto.monitoringEvent.eventName,
    occurredOn: dto.monitoringEvent.occurredOn,
    classification: toClassificationView(dto.classification),
    report: dto.investigationReport
      ? toInvestigationReportView(dto.investigationReport)
      : null,
    feedback: dto.feedback,
    correctFeedbackCount: dto.correctFeedbackCount,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

/** 分析中（未知障害の調査待ち）か。SSE の ANALYZING→OPEN 演出で使う純関数。 */
export function isAnalyzing(alert: AlertView): boolean {
  return alert.status === "ANALYZING";
}

/**
 * カードに出す代表 confidence(0..1)。調査レポートがあれば AI 確信度、
 * なければ既知パターンの分類確信度。未知・未分析は null。
 */
export function primaryConfidence(alert: AlertView): number | null {
  if (alert.report) return alert.report.confidence;
  return alert.classification.confidence;
}
