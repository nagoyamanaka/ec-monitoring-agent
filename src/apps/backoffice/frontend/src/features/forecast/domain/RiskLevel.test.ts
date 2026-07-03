import { describe, expect, it } from "vitest";
import {
  compareRiskDesc,
  normalizeRiskLevel,
  riskLevelLabel,
  riskLevelRank,
} from "./RiskLevel";

describe("normalizeRiskLevel", () => {
  it("既知レベルはそのまま返す", () => {
    expect(normalizeRiskLevel("HIGH")).toBe("HIGH");
    expect(normalizeRiskLevel("MEDIUM")).toBe("MEDIUM");
    expect(normalizeRiskLevel("LOW")).toBe("LOW");
  });

  it("未知の文字列は LOW（盛らない側）へ丸める", () => {
    expect(normalizeRiskLevel("CRITICAL")).toBe("LOW");
    expect(normalizeRiskLevel("")).toBe("LOW");
  });
});

describe("compareRiskDesc", () => {
  it("level 降順（HIGH→MEDIUM→LOW）に並ぶ", () => {
    const sorted = [
      { level: "LOW" as const, confidence: 0.9 },
      { level: "HIGH" as const, confidence: 0.1 },
      { level: "MEDIUM" as const, confidence: 0.5 },
    ].sort(compareRiskDesc);
    expect(sorted.map((r) => r.level)).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });

  it("同 level 内は confidence 降順", () => {
    const sorted = [
      { level: "HIGH" as const, confidence: 0.4 },
      { level: "HIGH" as const, confidence: 0.8 },
    ].sort(compareRiskDesc);
    expect(sorted.map((r) => r.confidence)).toEqual([0.8, 0.4]);
  });
});

describe("riskLevelRank / riskLevelLabel", () => {
  it("HIGH が最上位ランク・日本語ラベルを返す", () => {
    expect(riskLevelRank("HIGH")).toBeGreaterThan(riskLevelRank("MEDIUM"));
    expect(riskLevelRank("MEDIUM")).toBeGreaterThan(riskLevelRank("LOW"));
    expect(riskLevelLabel("HIGH")).toBe("高リスク");
  });
});
