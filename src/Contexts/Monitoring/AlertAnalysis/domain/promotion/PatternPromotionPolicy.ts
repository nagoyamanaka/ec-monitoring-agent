import { Alert } from "../Alert.js";

// 「いつ未知パターンを既知へ昇格（＝完全一致の高速パスに焼き付ける結晶化）するか」の判定。
// 判定ロジックのみを担い、「どう昇格するか」（KnownErrorPattern 構築・save・ログ）は UseCase に残す。
// 分類側の AlertClassifier/ClassificationPolicy/Rule と対称の差し替え可能な口。
export interface PatternPromotionPolicy {
  shouldPromote(alert: Alert): boolean;
}
