import { ClassificationRule } from "./ClassificationRule.js";
import { ClassificationRuleKind } from "./ClassificationRuleKind.js";

// 分類ルールを優先度順に並べ替えるドメインサービス。
// 優先順位は「ルール間の関係」なのでここに集約する（priority 数値を Rule に持たせない）。
// 具体実装に依存せず kind しか見ないため domain に置ける（DIP を侵さない）。
export class ClassificationRuleSorter {
  // 優先度の降順（先頭ほど高優先）。完全一致 > 類似 > AI推論。
  private static readonly PRECEDENCE: readonly ClassificationRuleKind[] = [
    ClassificationRuleKind.EXACT_MATCH,
    ClassificationRuleKind.SIMILARITY,
    ClassificationRuleKind.INFERENCE,
  ];

  // 渡された配列の順序に依存せず、kind の優先順位で確定的に並べる。
  // Array.prototype.sort は安定ソート（ES2019+）なので同 kind は元の順序を保つ。
  sort(rules: ClassificationRule[]): ClassificationRule[] {
    return [...rules].sort(
      (a, b) =>
        ClassificationRuleSorter.precedenceOf(a.kind) -
        ClassificationRuleSorter.precedenceOf(b.kind),
    );
  }

  private static precedenceOf(kind: ClassificationRuleKind): number {
    return ClassificationRuleSorter.PRECEDENCE.indexOf(kind);
  }
}
