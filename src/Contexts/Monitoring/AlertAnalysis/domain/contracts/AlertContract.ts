import type { MonitoringEventPrimitives } from "../../../Shared/domain/contracts/MonitoringEventContract.js";

/**
 * Alert 集約のシリアライズ契約（ワイヤ形式）。
 * backend の Alert.toPrimitives() 出力＝frontend が受信する JSON の単一ソース。
 * ランタイム依存ゼロ（純粋な型のみ）。domain の値オブジェクトはここに置かない。
 *
 * backend 側は各 domain ファイルがここから re-export するため import 文は無変更。
 * frontend 側はこの契約を直接 import し、View 型へ写像する（Node の集約グラフを引き込まない）。
 */

export type MatchedCondition = {
  readonly field: string;
  readonly expectedValue: unknown;
  readonly actualValue: unknown;
};

export type UnmatchedCondition = {
  readonly field: string;
  readonly expectedValue: unknown;
  readonly actualValue: unknown;
};

export type KnownAlertClassificationPrimitives = {
  readonly type: "known";
  readonly patternId: string;
  readonly patternName: string;
  readonly severity: string;
  readonly confidence: number;
  readonly matchedConditions: MatchedCondition[];
  readonly unmatchedConditions: UnmatchedCondition[];
};

export type UnknownAlertClassificationPrimitives = {
  readonly type: "unknown";
  readonly confidence: null;
};

export type AlertClassificationPrimitives =
  | KnownAlertClassificationPrimitives
  | UnknownAlertClassificationPrimitives;

export type InvestigationReportPrimitives = {
  readonly summary: string;
  readonly confidence: number;
  readonly severity: string;
  readonly investigationSteps: string[];
  readonly suggestedActions: string[];
  readonly suggestedPatternName: string;
  readonly reviewStatus: string;
  readonly investigatedAt: string;
  readonly isFallback: boolean;
};

export type AlertPrimitives = {
  id: string;
  monitoringEvent: MonitoringEventPrimitives;
  severity: string;
  status: string;
  classification: AlertClassificationPrimitives;
  investigationReport: InvestigationReportPrimitives | null;
  feedback: { isCorrect: boolean; operatorNote?: string } | null;
  correctFeedbackCount: number;
  createdAt: string;
  updatedAt: string;
};
