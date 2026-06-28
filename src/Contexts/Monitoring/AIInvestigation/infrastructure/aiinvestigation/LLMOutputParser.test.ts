import { describe, it, expect } from "vitest";
import { parseLLMOutput } from "./LLMOutputParser.js";

const validJson = JSON.stringify({
  summary: "DB接続枯渇",
  confidence: 0.87,
  severity: "CRITICAL",
  investigationSteps: ["ログ確認"],
  suggestedActions: ["プール拡張"],
  suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
});

describe("LLMOutputParser", () => {
  describe("parseLLMOutput", () => {
    it("素のJSON文字列をパースする", () => {
      const out = parseLLMOutput(validJson);
      expect(out).not.toBeNull();
      expect(out?.summary).toBe("DB接続枯渇");
      expect(out?.confidence).toBe(0.87);
    });

    it("```json フェンス付きテキストからJSONを抽出する", () => {
      const fenced = "前置き\n```json\n" + validJson + "\n```\n後書き";
      const out = parseLLMOutput(fenced);
      expect(out?.severity).toBe("CRITICAL");
    });

    it("言語指定なしの``` フェンスからも抽出する", () => {
      const fenced = "```\n" + validJson + "\n```";
      expect(parseLLMOutput(fenced)?.summary).toBe("DB接続枯渇");
    });

    it("不正なJSONではnullを返す", () => {
      expect(parseLLMOutput("これはJSONではない")).toBeNull();
      expect(parseLLMOutput("{壊れた")).toBeNull();
    });

    it("必須フィールド欠落ではnullを返す", () => {
      const missing = JSON.stringify({ summary: "x", confidence: 0.5 });
      expect(parseLLMOutput(missing)).toBeNull();
    });

    it("remediable は欠落・非boolはfalse、true指定のみtrueになる", () => {
      expect(parseLLMOutput(validJson)?.remediable).toBe(false);
      const truthy = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "", remediable: true,
      });
      expect(parseLLMOutput(truthy)?.remediable).toBe(true);
      const notBool = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "", remediable: "yes",
      });
      expect(parseLLMOutput(notBool)?.remediable).toBe(false);
    });

    it("steps/actions の非文字列要素は落とす（防御的正規化）", () => {
      const mixed = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: ["ログ確認", { text: "obj" }, 42, "メトリクス相関"],
        suggestedActions: ["対応", null],
        suggestedPatternName: "",
      });
      const out = parseLLMOutput(mixed);
      expect(out?.investigationSteps).toEqual(["ログ確認", "メトリクス相関"]);
      expect(out?.suggestedActions).toEqual(["対応"]);
    });

    it("型不一致(confidenceが文字列)ではnullを返す", () => {
      const badType = JSON.stringify({
        summary: "x",
        confidence: "high",
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
      });
      expect(parseLLMOutput(badType)).toBeNull();
    });

    it("relatedAlerts は欠落で空配列・3フィールド揃った要素のみ残す", () => {
      // 欠落（旧スキーマ互換）
      expect(parseLLMOutput(validJson)?.relatedAlerts).toEqual([]);

      const withRelated = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
        relatedAlerts: [
          { alertId: "a1", relation: "same_root_cause", rationale: "同根" },
          { alertId: "a2", relation: "downstream" }, // rationale 欠落 → 落とす
          "not-an-object", // 型不正 → 落とす
          { alertId: 3, relation: "x", rationale: "y" }, // alertId 非文字列 → 落とす
        ],
      });
      expect(parseLLMOutput(withRelated)?.relatedAlerts).toEqual([
        { alertId: "a1", relation: "same_root_cause", rationale: "同根" },
      ]);
    });

    it("impact は欠落で undefined・揃った構造はそのままパースする", () => {
      // 欠落（旧スキーマ互換）
      expect(parseLLMOutput(validJson)?.impact).toBeUndefined();

      const withImpact = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
        impact: {
          fault: "external",
          scope: "外部決済APIのタイムアウト",
          scale: "決済の約3%が失敗",
          affectedSubjects: ["payment", "checkout"],
          citations: ["log:abc", "incident:i1"],
        },
      });
      expect(parseLLMOutput(withImpact)?.impact).toEqual({
        fault: "external",
        scope: "外部決済APIのタイムアウト",
        scale: "決済の約3%が失敗",
        affectedSubjects: ["payment", "checkout"],
        citations: ["log:abc", "incident:i1"],
      });
    });

    it("impact.fault が own/external/unknown 以外なら unknown に丸める", () => {
      const badFault = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        impact: { fault: "maybe", scope: "s", scale: "n", affectedSubjects: [], citations: ["c1"] },
      });
      expect(parseLLMOutput(badFault)?.impact?.fault).toBe("unknown");
    });

    it("impact の scope/scale が文字列でなければ undefined（構造不正）", () => {
      const noScope = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        impact: { fault: "own", scale: "n", affectedSubjects: [], citations: ["c1"] },
      });
      expect(parseLLMOutput(noScope)?.impact).toBeUndefined();
    });

    it("impact.citations の空白文字列を除く・非配列フィールドは空配列に丸める", () => {
      const messy = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        impact: { fault: "own", scope: "s", scale: "n", affectedSubjects: "oops", citations: ["c1", "  ", "", "c2"] },
      });
      const impact = parseLLMOutput(messy)?.impact;
      expect(impact?.affectedSubjects).toEqual([]);
      expect(impact?.citations).toEqual(["c1", "c2"]);
    });

    it("relatedAlerts が配列でなければ空配列に丸める", () => {
      const notArray = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
        relatedAlerts: "oops",
      });
      expect(parseLLMOutput(notArray)?.relatedAlerts).toEqual([]);
    });
  });
});
