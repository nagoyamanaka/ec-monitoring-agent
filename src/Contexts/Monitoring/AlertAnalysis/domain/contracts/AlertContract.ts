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
  // 類似既知（SIMILARITY）分類のとき、元になった解決済み Alert への back-link。
  // 「過去の同型障害をどう直したか」へ内部遷移（/alerts/:id）する動線に使う。
  // optional は EXACT_MATCH / INFERENCE では未設定・旧データ互換のため（dedupKey と同じ規約）。
  readonly sourceAlertId?: string;
};

export type UnknownAlertClassificationPrimitives = {
  readonly type: "unknown";
  readonly confidence: null;
};

export type AlertClassificationPrimitives =
  | KnownAlertClassificationPrimitives
  | UnknownAlertClassificationPrimitives;

// 外部サービスへのディープリンク種別。表示側はアイコンを出し分ける（log=Cloud Logging,
// code=GitHub, runbook=手順書, console=Cloud Console 等）。
export type InvestigationLinkKind = "log" | "code" | "runbook" | "console";

/**
 * 調査ステップ／推奨アクションの1項目。`href` があればフロントは外部リンク化し、
 * `kind` でアイコンを出し分ける。`text` は人間が読む説明。
 */
export type InvestigationStepPrimitives = {
  readonly text: string;
  readonly href?: string;
  readonly kind?: InvestigationLinkKind;
};

/**
 * 調査ステップ／推奨アクションの配列要素。LLM 出力・旧データは素の文字列、
 * seed／将来の構造化配信は {text, href?, kind?} を載せる後方互換ユニオン。
 * フロントは `toInvestigationReportView` で常に構造化形へ正規化する。
 */
export type InvestigationItemPrimitives = string | InvestigationStepPrimitives;

/**
 * AI 調査が見つけた相関アラート（id・関係・根拠）。
 * 検知層の dedup（同一 dedupKey の occurrenceCount＝同型の嵐の畳み込み）とは別軸で、
 * 異なるアラート間の関係（例: DB 枯渇=infra と payment 失敗=app が同一根本原因）を示す。
 * 相関エンジンは作らず、AI 調査の副産物（step4-1 §2.5(c)）として relation＋rationale を載せる。
 */
export type RelatedAlertPrimitives = {
  readonly alertId: string;
  // 関係種別（same_root_cause / downstream / upstream / precursor / similar 等の文字列）。
  // 表示側は人間語ラベルへ写像し、未知文字列はそのまま出す。
  readonly relation: string;
  // なぜ関連と判断したか（AI の根拠・1 文）。
  readonly rationale: string;
};

export type InvestigationReportPrimitives = {
  readonly summary: string;
  readonly confidence: number;
  readonly severity: string;
  readonly investigationSteps: InvestigationItemPrimitives[];
  readonly suggestedActions: InvestigationItemPrimitives[];
  readonly suggestedPatternName: string;
  readonly reviewStatus: string;
  readonly investigatedAt: string;
  readonly isFallback: boolean;
  // AI 調査が見つけた相関アラート。optional は旧データ・fallback 互換（未保存なら空配列扱い）。
  readonly relatedAlerts?: RelatedAlertPrimitives[];
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
