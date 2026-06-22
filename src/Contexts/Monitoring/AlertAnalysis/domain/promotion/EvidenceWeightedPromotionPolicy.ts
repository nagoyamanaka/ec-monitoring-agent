import { Alert } from "../Alert.js";
import { PatternPromotionPolicy } from "./PatternPromotionPolicy.js";

// 加重スコアの調整ノブ。composition root（step4-3 DI）で env から差し込めるよう外出し。
// 既定値は「証拠加点ゼロなら FixedThreshold(N=3) と一致」する後方互換キャリブレーション。
export type EvidenceWeights = {
  // この値以上で昇格（結晶化）する。
  promoteThreshold: number;
  // 人間の正解承認 1 回あたりの加点（最も信頼する主信号）。
  humanWeightPerFeedback: number;
  // 二次信号（confidence）の高/中バンドのしきい値と加点。
  highConfidence: number;
  highConfidenceWeight: number;
  midConfidence: number;
  midConfidenceWeight: number;
};

// 証拠ゼロでも correctFeedbackCount=3 で 0.4*3=1.2≥1.0＝従来挙動と一致する既定値。
export const DEFAULT_EVIDENCE_WEIGHTS: EvidenceWeights = {
  promoteThreshold: 1.0,
  humanWeightPerFeedback: 0.4,
  highConfidence: 0.8,
  highConfidenceWeight: 0.3,
  midConfidence: 0.6,
  midConfidenceWeight: 0.1,
};

// 証拠加重による結晶化ゲート（タスク25）。FixedThreshold の「全 Alert 等しく N 回」を、
// 「似ている度／確度が高いものは少ない確認で焼き付け、低ければ複数回要求」へ加重化する。
//
// score = humanWeight(correctFeedbackCount) + confidenceWeight(report.confidence)
// score >= promoteThreshold で昇格。
//
// 信頼順位の設計（重み付けの根拠）: 人間の承認 > 類似の積み上げ（SimilarIncident 母集団）
// > AI 自己申告 confidence。人間承認を主信号（係数最大）に、確度は補助係数に留める。
//
// 二次信号の出どころに関する設計判断（重要）:
//   昇格候補は常に classification.type==="unknown"（既知/類似一致は createFromKnownPattern 経由で
//   昇格対象外）。UnknownAlertClassification.confidence は常に null なので、タスク17 の
//   「類似確度（classification.confidence）」は昇格パスの Alert には載っていない。
//   そこで Alert が実際に持つ graded confidence＝investigationReport.confidence を二次信号に使う。
//   これは InvestigateAlertUseCase が SimilarIncident 母集団を AI 調査コンテキストへ流し込んだ結果の
//   確度なので、「類似の積み上げに裏打ちされた確度」という設計意図と整合する。AI 自己申告そのものを
//   主役にはせず、人間承認より小さい係数に抑える（過信の較正未済を考慮）。
export class EvidenceWeightedPromotionPolicy implements PatternPromotionPolicy {
  private readonly weights: EvidenceWeights;

  constructor(weights: Partial<EvidenceWeights> = {}) {
    this.weights = { ...DEFAULT_EVIDENCE_WEIGHTS, ...weights };
  }

  shouldPromote(alert: Alert): boolean {
    // ハード除外: 既知分類／レポート無／fallback は加点に関わらず昇格しない（FixedThreshold と同条件）。
    if (alert.classification.type !== "unknown") return false;
    const report = alert.investigationReport;
    if (report === null) return false;
    if (report.isFallback) return false;

    const score =
      this.humanWeight(alert.correctFeedbackCount) +
      this.confidenceWeight(report.confidence);

    return score >= this.weights.promoteThreshold;
  }

  // 主信号: 人間の正解承認回数に比例。
  private humanWeight(correctFeedbackCount: number): number {
    return correctFeedbackCount * this.weights.humanWeightPerFeedback;
  }

  // 二次信号: 確度を高/中の2バンドで加点（バンド外は 0）。
  private confidenceWeight(confidence: number): number {
    if (confidence >= this.weights.highConfidence) {
      return this.weights.highConfidenceWeight;
    }
    if (confidence >= this.weights.midConfidence) {
      return this.weights.midConfidenceWeight;
    }
    return 0;
  }
}
