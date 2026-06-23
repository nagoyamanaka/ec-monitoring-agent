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
  // どの分類ルールが当てたか（ClassificationRuleKind の文字列値: EXACT_MATCH / SIMILARITY / INFERENCE）。
  // 「完全一致」と「類似一致」を patternId プレフィックス等で嗅ぎ分けず一級の判別子として持つ。
  readonly source: string;
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
  // AI が「コードで直せる（PR で remediate 可能）」と判定したか。category 非依存の
  // 汎用シグナルで、フロントは remediate ボタンの活性／ROI 提示の判断に使う（advisory）。
  // 実際の write 実行ゲートは人間承認＋executor の deterministic 判定が握る。
  // optional は旧データ互換（未保存なら false 扱い／dedupKey と同じ規約）。
  readonly remediable?: boolean;
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
  // 重複観測の畳み込みキーと発生回数。同一 dedupKey の OPEN/ANALYZING Alert は
  // 新規作成せず occurrenceCount を加算する（アラート嵐の抑制・UI は「×N」表示）。
  // optional は旧データ互換（未保存なら backend が dedupKey 再導出・count=1 で補完）。
  dedupKey?: string;
  occurrenceCount?: number;
  createdAt: string;
  updatedAt: string;
};
