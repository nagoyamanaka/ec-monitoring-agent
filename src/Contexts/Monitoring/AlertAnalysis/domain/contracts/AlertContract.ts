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

/** 自責他責ラベル。own=自社コード/IaC 起因 / external=外部API・ベンダー起因 / unknown=証拠不足で断定不能。 */
export type ImpactFault = "own" | "external" | "unknown";

/**
 * 「今回ぶんの判断」＝影響評価（自責他責・影響範囲・障害規模）。根本原因（再利用可能）と違い
 * 毎回変わるので既知ルートでも算定が要る（タスク34）。`fault` は出口（Remediation / Runbook）の
 * 振り分け信号。`citations` は収集済み証拠/類似事例の id 参照で、空の impact は表示前に落とす
 * （根拠なき影響主張＝ハルシネーションを出さないガード。§7.3 と同方針）。
 */
export type ImpactAssessmentPrimitives = {
  readonly fault: ImpactFault;
  // 影響範囲（どの機能・どのユーザ層が影響を受けるか・日本語1文）。
  readonly scope: string;
  // 障害規模（件数・割合・継続時間などの定量/定性表現・日本語1文）。
  readonly scale: string;
  // 影響を受けた主体（サービス名・チーム・顧客セグメント等）。
  readonly affectedSubjects: string[];
  // 算定根拠の引用（証拠ログ／類似インシデント／commit/terraform 差分の id）。
  readonly citations: string[];
};

/**
 * 他責/運用案件のエスカレーション草案（タスク35）。impact.fault が external/運用のとき
 * RunbookEscalationAgent が起案する。RemediationPlan（自責→コード/IaC PR）と排他で出口を分ける。
 * `team` は体制マスタ（EscalationDirectory）由来で、捏造させない＝宛先を引けないと空文字になり
 * マッパ側で落とされる（根拠なき宛先＝ハルシネーションを出さないガード。impact の citations と同方針）。
 * 起案までで、実際の通知送信・チケット起票はしない（write は人間承認ゲートの内側に閉じる）。
 */
export type EscalationDraftPrimitives = {
  // エスカレーション先チーム（体制マスタ由来）。引けない場合は空文字＝宛先不明。
  readonly team: string;
  // 一次受けの担当者（オンコール代表など）。
  readonly owner: string;
  // 連絡先（Slack チャンネル・メール・PagerDuty 等）。
  readonly contact: string;
  // なぜこのチーム/運用対応なのか（fault=external/運用の根拠と affectedSubjects との対応・1文）。
  readonly reason: string;
  // 暫定回避手順（過去 resolvedNote を根拠に具体化・人間が引き継ぐまでの一次対応）。
  readonly interimWorkaround: string;
  // 重大度の根拠（impact.scale と slaTier から・1文）。
  readonly severityRationale: string;
  // 引き継ぎに添付すべき証拠/引用の id（証拠ログ・類似事例・commit/terraform 差分の id）。
  readonly evidenceBundle: string[];
};

/** 修正PR自動レビューの判定（タスク36）。pass=引用根本原因に対応し整合 / concerns=要確認の懸念あり / reject=根本原因に無関係・誤修正。 */
export type RemediationVerdict = "pass" | "concerns" | "reject";

/**
 * AI/CI が起票した修正PRの自動レビュー結果（タスク36・RV段階）。read-only レビューで
 * (1)diff が引用根本原因に対応するか (2)変更ファイルが証拠と整合するか (3)テストが障害経路を
 * カバーするか を判定し、誤修正を人間到達前に止める（人間の RV を open-ended 監査→checklist 確認へ縮める）。
 * `pullRequestUrl` 空（レビュー対象 PR を引けなかった＝何をレビューしたか不明）はマッパ側で落とす
 * （根拠なき verdict を出さないガード。impact の citations・escalation の team と同方針）。
 * verdict を出すだけで自動マージはしない（承認・マージは人間の reviewStatus ゲート）。
 */
export type RemediationReviewPrimitives = {
  // 判定。concerns/reject のときは concerns に理由を必須化する。
  readonly verdict: RemediationVerdict;
  // 懸念点（なぜ pass でないか）。pass のときは空配列でよい。
  readonly concerns: string[];
  // レビュー対象 PR（advisory では草案 PR）の URL。引けない場合は空文字＝マッパ側で落とす。
  readonly pullRequestUrl: string;
  // 判定根拠の引用（diff hunk・変更ファイルパス・テスト名・CI チェック id 等）。
  readonly citations: string[];
};

/**
 * 調査が実際に読んだ証拠の件数内訳（タスク G1「働きの明細」）。
 * 全てシステムが記録した事実のみ（「人間なら◯分」等の換算はしない＝盛らない制約）。
 * 表示側はここから横断ソース（Cloud Logging / GitHub / Terraform / Cloud Monitoring / 類似事例DB）
 * と証拠合計を導出する（単一ソース＝件数と表示が乖離しない）。
 */
export type InvestigationEvidenceCountsPrimitives = {
  // Cloud Logging のアプリログ件数。
  readonly logs: number;
  // Cloud Monitoring の相関メトリクス件数。
  readonly metrics: number;
  // Terraform 適用差分の変更リソース件数。
  readonly terraformChanges: number;
  // GitHub の直近コミット件数。
  readonly commits: number;
  // 過去の類似インシデント（解決事例）件数。
  readonly similarIncidents: number;
};

/**
 * 調査の実測メトリクス（タスク G1）。elapsedMs は AI 調査呼び出しの実測経過時間で、
 * ADK / 単一 Gemini のどちらの経路でも UseCase 側が同じ形で計測・添付する。
 */
export type InvestigationMetricsPrimitives = {
  readonly elapsedMs: number;
  readonly evidenceCounts: InvestigationEvidenceCountsPrimitives;
};

/**
 * 確信度キャリブレーションの裏付けシグナル。LLM の作文ではなく、システムが検証できる事実のみ
 * （既知パターン一致／報告書が引用した原因コミット／適用済み Terraform 差分／実在候補と突合済みの
 * 相関アラート／類似事例／再調査時の人間の指摘）。
 */
export type ConfidenceGroundingSignal =
  | "known_pattern"
  | "cited_commit"
  | "terraform_diff"
  | "related_alert"
  | "similar_incident"
  | "operator_note";

/**
 * 確信度キャリブレーションの記録（ConfidenceCalibration＝domain 純関数が導出）。
 * confidence 本体には補正後の値が入り、ここには「どう補正したか」の説明責任情報を残す
 * （signals→表示ラベル、cap=シグナル由来の上限、original=LLM 自己申告）。
 */
export type ConfidenceCalibrationPrimitives = {
  readonly signals: ConfidenceGroundingSignal[];
  readonly cap: number;
  readonly original: number;
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
  // 影響評価（自責他責ルータの入力）。optional は後方互換＝impact 無しの旧 Alert も読める。
  // 根拠（citations）の無い impact はマッパ側で落とすので、保存される impact は必ず引用付き。
  readonly impact?: ImpactAssessmentPrimitives;
  // 他責/運用案件のエスカレーション草案（impact.fault=external/運用ルートの出口）。optional は
  // 後方互換＝escalation 無しの旧 Alert・自責ルートでは未設定。team 空の草案はマッパ側で落とすので、
  // 保存される escalation は必ず宛先付き。
  readonly escalation?: EscalationDraftPrimitives;
  // 修正PRの自動レビュー結果（タスク36・RV段階）。optional は後方互換＝review 無しの旧 Alert・
  // PR 未起票（初期調査時点）では未設定。pullRequestUrl 空の review はマッパ側で落とすので、
  // 保存される review は必ずレビュー対象 PR 付き。
  readonly remediationReview?: RemediationReviewPrimitives;
  // AI が「コードで直せる（PR で remediate 可能）」と判定したか。category 非依存の
  // 汎用シグナルで、フロントは remediate ボタンの活性／ROI 提示の判断に使う（advisory）。
  // 実際の write 実行ゲートは人間承認＋executor の deterministic 判定が握る。
  // optional は旧データ互換（未保存なら false 扱い／dedupKey と同じ規約）。
  readonly remediable?: boolean;
  // Forecast 突合キー（コンポーネントラベル。例: "db_connection_pool_exhaustion"）。
  // 調査時に deterministic に導出して埋める（LLM 出力ではない）。ForecastMemory projection が
  // 解決済み事例のタグとして読む。optional は後方互換＝subject 無しの旧 Alert も読める。
  readonly subject?: string;
  // 調査の実測メトリクス（経過時間・証拠件数内訳＝タスク G1「働きの明細」）。LLM 出力ではなく
  // UseCase が計測して deterministic に添付する。optional は後方互換＝旧 Alert・未計測でも読める。
  readonly metrics?: InvestigationMetricsPrimitives;
  // 確信度キャリブレーションの記録（裏付けシグナル・上限・自己申告値）。UseCase が deterministic に
  // 添付する（LLM 出力ではない）。optional は後方互換＝旧 Alert・fallback では未設定。
  readonly confidenceCalibration?: ConfidenceCalibrationPrimitives;
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
