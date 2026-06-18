import { describe, it, expect } from "vitest";
import { ClassificationRuleSorter } from "./ClassificationRuleSorter.js";
import { ClassificationRule } from "./ClassificationRule.js";
import { ClassificationRuleKind } from "./ClassificationRuleKind.js";

class StubRule implements ClassificationRule {
  constructor(
    readonly kind: ClassificationRuleKind,
    readonly id: string,
  ) {}
  async classify(): Promise<null> {
    return null;
  }
}

describe("ClassificationRuleSorter", () => {
  const sorter = new ClassificationRuleSorter();

  it("kind 優先順位（EXACT_MATCH > SIMILARITY > INFERENCE）で並べ替える", () => {
    const rules = [
      new StubRule(ClassificationRuleKind.INFERENCE, "ai"),
      new StubRule(ClassificationRuleKind.EXACT_MATCH, "exact"),
      new StubRule(ClassificationRuleKind.SIMILARITY, "similar"),
    ];

    const sorted = sorter.sort(rules) as StubRule[];

    expect(sorted.map((r) => r.id)).toEqual(["exact", "similar", "ai"]);
  });

  it("渡した配列の順序に依存せず確定的に並ぶ", () => {
    const sortedA = sorter.sort([
      new StubRule(ClassificationRuleKind.SIMILARITY, "s"),
      new StubRule(ClassificationRuleKind.EXACT_MATCH, "e"),
    ]) as StubRule[];
    const sortedB = sorter.sort([
      new StubRule(ClassificationRuleKind.EXACT_MATCH, "e"),
      new StubRule(ClassificationRuleKind.SIMILARITY, "s"),
    ]) as StubRule[];

    expect(sortedA.map((r) => r.id)).toEqual(["e", "s"]);
    expect(sortedB.map((r) => r.id)).toEqual(["e", "s"]);
  });

  it("同 kind は安定ソートで元の順序を保つ", () => {
    const sorted = sorter.sort([
      new StubRule(ClassificationRuleKind.EXACT_MATCH, "first"),
      new StubRule(ClassificationRuleKind.EXACT_MATCH, "second"),
    ]) as StubRule[];

    expect(sorted.map((r) => r.id)).toEqual(["first", "second"]);
  });

  it("元配列を破壊しない", () => {
    const rules = [
      new StubRule(ClassificationRuleKind.INFERENCE, "ai"),
      new StubRule(ClassificationRuleKind.EXACT_MATCH, "exact"),
    ];

    sorter.sort(rules);

    expect((rules[0] as StubRule).id).toBe("ai");
  });
});
