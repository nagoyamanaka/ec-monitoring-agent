import { Alert } from "../Alert.js";
import { ClassificationRuleKind } from "../classification/ClassificationRuleKind.js";

// 「いつ未知パターンを既知へ昇格（＝完全一致の高速パスに焼き付ける結晶化）するか」の判定。
// 判定ロジックのみを担い、「どう昇格するか」（KnownErrorPattern 構築・save・ログ）は UseCase に残す。
// 分類側の AlertClassifier/ClassificationPolicy/Rule と対称の差し替え可能な口。
export interface PatternPromotionPolicy {
  shouldPromote(alert: Alert): boolean;
}

// 昇格（結晶化）の対象になり得る分類か（全ポリシー共通のハード条件）。
// 未知に加え、類似既知（SIMILARITY）も対象＝人間の承認を重ねた準・既知が永遠に類似止まり
// （確度 <100%・毎回類似検索）にならず、完全一致の既知（即・確度100%・決定論）へ登れるようにする。
// 完全一致（EXACT_MATCH）等の既知は既に高速パスに乗っているため対象外。
export function isPromotableClassification(alert: Alert): boolean {
  const classification = alert.classification;
  return (
    classification.type === "unknown" ||
    classification.source === ClassificationRuleKind.SIMILARITY
  );
}
