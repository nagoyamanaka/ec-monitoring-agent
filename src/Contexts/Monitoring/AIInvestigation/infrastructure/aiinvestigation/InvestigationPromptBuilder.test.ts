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
});
