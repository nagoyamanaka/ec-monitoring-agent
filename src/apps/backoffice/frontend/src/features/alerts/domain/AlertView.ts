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

/** 一致した分類条件（既知パターンの根拠）。 */
export type MatchedConditionView = {
  readonly field: string;
  readonly expectedValue: unknown;
  readonly actualValue: unknown;
};

/** 分類結果の表示用型。未知障害（unknown）は confidence が null。 */
export type AlertClassificationView =
  | {
      readonly type: "known";
      readonly patternId: string;
      readonly patternName: string;
      readonly confidence: number;
      /** 既知パターン一致の根拠（どの条件が一致したか）。ドロワーで「なぜ」を見せる。 */
      readonly matchedConditions: MatchedConditionView[];
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
      matchedConditions: dto.matchedConditions.map((c) => ({
        field: c.field,
        expectedValue: c.expectedValue,
        actualValue: c.actualValue,
      })),
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
