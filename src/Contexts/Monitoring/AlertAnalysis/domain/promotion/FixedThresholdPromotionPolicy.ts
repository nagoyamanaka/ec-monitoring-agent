import { Alert } from "../Alert.js";
import {
  isPromotableClassification,
  PatternPromotionPolicy,
} from "./PatternPromotionPolicy.js";

// 正解フィードバックがこの回数に達したら未知パターンを自動昇格する（デモ調整用に env で上書き可能）。
const DEFAULT_AUTO_PROMOTE_THRESHOLD = Number(
  process.env.FEEDBACK_AUTO_PROMOTE_THRESHOLD ?? 3,
);

// 固定回数による結晶化トリガー（現挙動）。全 Alert を等しく扱う。
// correctFeedbackCount >= N かつ 昇格対象分類（未知/類似既知） かつ 調査レポート有（かつ fallback でない）で昇格。
// 証拠加重への進化は EvidenceWeightedPromotionPolicy（タスク25）が同 IF で差し替える。
export class FixedThresholdPromotionPolicy implements PatternPromotionPolicy {
  constructor(
    private readonly threshold: number = DEFAULT_AUTO_PROMOTE_THRESHOLD,
  ) {}

  shouldPromote(alert: Alert): boolean {
    if (alert.correctFeedbackCount < this.threshold) return false;
    if (!isPromotableClassification(alert)) return false;

    const report = alert.investigationReport;
    if (report === null) return false;
    if (report.isFallback) return false;

    return true;
  }
}
