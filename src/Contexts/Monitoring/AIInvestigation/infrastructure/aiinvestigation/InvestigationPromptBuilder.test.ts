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

    it("citableIdsに収集済み証拠のIDを全量列挙する（表示照合カタログと同一ソース・タスクD6）", () => {
      const context = baseContext({
        similarIncidents: [
          { eventName: "DBConnectionExhausted", occurredOn: "2026-06-19T00:00:00.000Z", resolvedNote: "プール拡張で復旧" },
        ],
        infraEvidence: {
          appLogs: [],
          collectedAt: new Date("2026-06-20T00:00:00.000Z"),
          recentCommits: [
            { sha: "a1b2c3d4e5f", message: "pool縮小", author: "dev", committedAt: new Date("2026-06-19T23:00:00.000Z") },
          ],
        },
        candidateAlerts: [
          { alertId: "alert-uuid-1", eventName: "OtherAlert", category: "CAPACITY", occurredOn: "2026-06-20T00:00:00.000Z", summary: "同時期" },
        ],
      } as Partial<InvestigationContext>);

      const parsed = JSON.parse(buildUserPrompt(context));
      expect(parsed.citableIds).toContain("PaymentTimeout"); // errorEvent.eventName
      expect(parsed.citableIds).toContain("a1b2c3d4e5f"); // commit sha
      expect(parsed.citableIds).toContain("DBConnectionExhausted"); // 類似事例 eventName
      expect(parsed.citableIds).toContain("alert-uuid-1"); // 相関候補 alertId
    });

    it("payloadのCVE識別子はcitableIdsに載る・orderId等の生データ値は載らない（シナリオ4）", () => {
      const context = baseContext({
        errorEvent: {
          eventName: "security.vulnerability.detected",
          occurredOn: "2026-06-20T00:00:00.000Z",
          payload: { orderId: "abc", vulnerabilities: [{ cveId: "CVE-2021-3807" }] },
          severity: "CRITICAL",
        },
      } as Partial<InvestigationContext>);

      const parsed = JSON.parse(buildUserPrompt(context));
      expect(parsed.citableIds).toContain("CVE-2021-3807");
      expect(parsed.citableIds).not.toContain("abc");
    });

    it("予算超過でsimilarIncidentsを削ってもcitableIdsはそのeventNameを保持する（収集済み事実は引用可能）", () => {
      const huge = "X".repeat(20000);
      const context = baseContext({
        similarIncidents: [
          { eventName: "HugeIncident", occurredOn: "2026-06-19T00:00:00.000Z", resolvedNote: huge },
        ],
      });

      const parsed = JSON.parse(buildUserPrompt(context));
      expect(parsed.similarIncidents).toEqual([]);
      expect(parsed.citableIds).toContain("HugeIncident");
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

  it("SYSTEM_INSTRUCTIONはcitableIds列挙からの逐語引用強制を含む（タスクD6）", () => {
    // この指示が消えると LLM が位置ラベル（"infraEvidence-1"）・payload UUID・プレフィックス装飾・
    // "N/A" 充填を発明し、実在照合で「未照合」が並ぶ表示に戻るため回帰で守る。
    // 記述で種類を縛る方式は失敗モードが移動し続けたため「全量リストから選ぶ」方式（2026-07-07）。
    expect(SYSTEM_INSTRUCTION).toContain("citableIds");
    expect(SYSTEM_INSTRUCTION).toContain("一字一句");
    // 実機で観測した失敗モードが悪い例として明示されていること。
    expect(SYSTEM_INSTRUCTION).toContain("infraEvidence-1");
    expect(SYSTEM_INSTRUCTION).toContain("N/A");
  });
});
