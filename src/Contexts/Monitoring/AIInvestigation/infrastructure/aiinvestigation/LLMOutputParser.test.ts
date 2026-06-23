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
  });
});
