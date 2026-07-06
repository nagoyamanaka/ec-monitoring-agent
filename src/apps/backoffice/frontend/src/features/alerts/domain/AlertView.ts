import type {
  AlertPrimitives,
  AlertClassificationPrimitives,
} from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import {
  type InvestigationReportView,
  toInvestigationReportView,
} from "./InvestigationReportView";
import {
  type SecurityFindingView,
  securityFindingsFromPayload,
} from "./SecurityFindingView";
import {
  type DetectionDetailView,
  detectionDetailFromPayload,
} from "./DetectionDetailView";

/**
 * Alert の表示用型と、ワイヤ契約（共有 contracts の AlertPrimitives）→ View の純関数。
 * domain は型＋純関数のみ。ワイヤ形式は backend と共有する単一ソース（型のみ・ランタイム非依存）を import する。
 * 文字列値は backend の AlertStatus / AlertSeverity / MonitoringEventCategory と整合する。
 */

export type AlertStatus = "OPEN" | "ANALYZING" | "RESOLVED";
export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO" | "PENDING";
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

/** 分類の由来（どのルールが当てたか）。backend の ClassificationRuleKind と整合。 */
export type ClassificationSource = "EXACT_MATCH" | "SIMILARITY" | "INFERENCE";

/** 分類結果の表示用型。未知障害（unknown）は confidence が null。 */
export type AlertClassificationView =
  | {
      readonly type: "known";
      /** 完全一致(EXACT_MATCH)/類似一致(SIMILARITY)/AI推論(INFERENCE) の判別子。表示の出し分けに使う。 */
      readonly source: ClassificationSource;
      readonly patternId: string;
      readonly patternName: string;
      readonly confidence: number;
      /** 既知パターン一致の根拠（どの条件が一致したか）。ドロワーで「なぜ」を見せる。 */
      readonly matchedConditions: MatchedConditionView[];
      /** 類似既知（SIMILARITY）のとき、元の解決済み Alert への内部リンク先 id（任意）。 */
      readonly sourceAlertId?: string;
      /** 類似既知（SIMILARITY）のとき、一致した解決済み事例の対応メモ（当時どう直したか・任意）。 */
      readonly resolvedNote?: string;
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
  /** 同一インシデントの重複観測をまとめた発生回数。2以上なら「×N」をカードに出す。 */
  readonly occurrenceCount: number;
  /**
   * SECURITY 検知（Trivy）が payload に運ぶ脆弱性一覧の射影。CVE ごとに NVD への
   * 実在リンクを持ち、証拠パネルの security セクションになる。非 SECURITY は空配列。
   */
  readonly securityFindings: SecurityFindingView[];
  /**
   * 検知ソースが payload に運ぶ発報の生情報（summary・検知ログ・対象リソース）。
   * eventName（dedup キー）が運べない「何が・どこで起きたか」の表示面。無ければ null。
   */
  readonly detectionDetail: DetectionDetailView | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toClassificationView(
  dto: AlertClassificationPrimitives,
): AlertClassificationView {
  if (dto.type === "known") {
    return {
      type: "known",
      source: dto.source as ClassificationSource,
      patternId: dto.patternId,
      patternName: dto.patternName,
      confidence: dto.confidence,
      matchedConditions: dto.matchedConditions.map((c) => ({
        field: c.field,
        expectedValue: c.expectedValue,
        actualValue: c.actualValue,
      })),
      ...(dto.sourceAlertId !== undefined
        ? { sourceAlertId: dto.sourceAlertId }
        : {}),
      ...(dto.resolvedNote !== undefined
        ? { resolvedNote: dto.resolvedNote }
        : {}),
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
    // 旧データ・契約 optional 互換: 未設定は 1 件として扱う。
    occurrenceCount: dto.occurrenceCount ?? 1,
    securityFindings: securityFindingsFromPayload(dto.monitoringEvent.payload),
    detectionDetail: detectionDetailFromPayload(dto.monitoringEvent.payload),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

/** 分析中（未知障害の調査待ち）か。SSE の ANALYZING→OPEN 演出で使う純関数。 */
export function isAnalyzing(alert: AlertView): boolean {
  return alert.status === "ANALYZING";
}

/**
 * AI のインフラ証拠調査の対象か。未知（unknown）アラートだけが調査パイプラインを通り、
 * Cloud Logging/Terraform/GitHub の証拠を持つ。既知（完全一致/類似）は即時分類で調査しないため
 * 証拠パネル（「AI が証拠を解析しています…」含む）を出さない。
 */
export function hasAiInvestigation(alert: AlertView): boolean {
  return alert.classification.type === "unknown";
}
