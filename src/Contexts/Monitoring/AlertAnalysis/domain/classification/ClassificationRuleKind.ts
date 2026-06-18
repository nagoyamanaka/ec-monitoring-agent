// ルールが生み出す「証拠の性質」を表す属性（ルール単体の性質なので Rule が持つ）。
// kind 間の優先順位（関係）は ClassificationRuleSorter が持つ。
export enum ClassificationRuleKind {
  EXACT_MATCH = "EXACT_MATCH", // 既知パターン完全一致（KnownPatternRule）
  SIMILARITY = "SIMILARITY", // 類似スコアリング（SimilarPatternRule / Elastic）
  INFERENCE = "INFERENCE", // AI 推論（AiInferenceRule）
}
