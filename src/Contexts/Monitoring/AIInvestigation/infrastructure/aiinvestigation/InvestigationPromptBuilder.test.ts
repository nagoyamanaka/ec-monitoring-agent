import { describe, it, expect } from "vitest";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "./InvestigationPromptBuilder.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";

function baseContext(overrides: Partial<InvestigationContext> = {}): InvestigationContext {
  return {
    errorEvent: {
      eventName: "PaymentTimeout",
      occurredOn: "2026-06-20T00:00:00.000Z",
      payload: { orderId: "abc" },
    },
    knownPatterns: [],
    similarIncidents: [],
    ...overrides,
  } as InvestigationContext;
}

describe("InvestigationPromptBuilder", () => {
  describe("buildUserPrompt", () => {
    it("予算内ならsimilarIncidentsを保持したJSON文字列を返す", () => {
      const context = baseContext({
        similarIncidents: [
          { eventName: "PaymentTimeout", occurredOn: "2026-06-19T00:00:00.000Z", resolvedNote: "再起動で復旧" },
        ],
      });

      const prompt = buildUserPrompt(context);
      const parsed = JSON.parse(prompt);

      expect(parsed.similarIncidents).toHaveLength(1);
      expect(parsed.errorEvent.eventName).toBe("PaymentTimeout");
    });

    it("infraEvidenceがある場合はプロンプトに含める", () => {
      const context = baseContext({
        infraEvidence: { appLogs: [], collectedAt: new Date("2026-06-20T00:00:00.000Z") },
      } as Partial<InvestigationContext>);

      const parsed = JSON.parse(buildUserPrompt(context));
      expect(parsed.infraEvidence).toBeDefined();
    });

    it("infraEvidenceが無い場合はキー自体を含めない", () => {
      const parsed = JSON.parse(buildUserPrompt(baseContext()));
      expect("infraEvidence" in parsed).toBe(false);
    });

    it("トークン予算(3,500)を超える場合はsimilarIncidentsを0件に削減する", () => {
      // 1件あたり十分大きいresolvedNoteで予算超過を誘発する（4文字≒1トークン換算）
      const huge = "X".repeat(20000);
      const context = baseContext({
        similarIncidents: [
          { eventName: "E", occurredOn: "2026-06-19T00:00:00.000Z", resolvedNote: huge },
        ],
      });

      const parsed = JSON.parse(buildUserPrompt(context));
      expect(parsed.similarIncidents).toEqual([]);
      // 削減後もerrorEvent/knownPatternsは残る
      expect(parsed.errorEvent).toBeDefined();
    });
  });

  it("SYSTEM_INSTRUCTIONはJSON出力を要求する指示を含む", () => {
    expect(SYSTEM_INSTRUCTION).toContain("JSON");
    expect(SYSTEM_INSTRUCTION).toContain("summary");
  });

  it("SYSTEM_INSTRUCTIONはconfidenceの較正基準（過信を抑える指示）を含む", () => {
    // 較正ルーブリックが消えると confidence が高アンカーに引きずられ過信に戻るため回帰で守る。
    expect(SYSTEM_INSTRUCTION).toContain("較正");
    expect(SYSTEM_INSTRUCTION).toContain("過信");
    // 証拠不足時は低く出す＝0.40 未満の基準が明示されていること。
    expect(SYSTEM_INSTRUCTION).toContain("0.40");
  });

  it("SYSTEM_INSTRUCTIONのJSON例confidenceは高アンカー(0.87)ではない", () => {
    // スキーマ例の値は LLM のアンカーになるため高値を置かない（中立な見本値であること）。
    expect(SYSTEM_INSTRUCTION).not.toContain('"confidence": 0.87');
  });
});
