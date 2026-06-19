import { describe, it, expect } from "vitest";
import { LLMInvestigationAdapter } from "./LLMInvestigationAdapter.js";
import { LLMTextClient } from "../../domain/LLMTextClient.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { AlertSeverities } from "../../../AlertAnalysis/domain/AlertSeverity.js";

const context: InvestigationContext = {
  errorEvent: { eventName: "PaymentTimeout", occurredOn: "2026-06-20T00:00:00.000Z", payload: {} },
  knownPatterns: [],
  similarIncidents: [],
};

/** 固定テキストを返すフェイク。Geminiを呼ばずにオーケストレーションを検証する。 */
class StubLLMTextClient implements LLMTextClient {
  constructor(private readonly behavior: { text?: string; error?: Error }) {}
  async generate(): Promise<string> {
    if (this.behavior.error) throw this.behavior.error;
    return this.behavior.text ?? "";
  }
}

const validJson = JSON.stringify({
  summary: "DB接続枯渇",
  confidence: 0.87,
  severity: "CRITICAL",
  investigationSteps: ["ログ確認"],
  suggestedActions: ["プール拡張"],
  suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
});

describe("LLMInvestigationAdapter", () => {
  it("正常なLLM応答をInvestigationReportに変換する", async () => {
    const adapter = new LLMInvestigationAdapter(new StubLLMTextClient({ text: validJson }));

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(false);
    expect(report.summary).toBe("DB接続枯渇");
    expect(report.severity.value).toBe(AlertSeverities.CRITICAL);
  });

  it("LLM呼び出しが例外を投げたらfallbackを返す", async () => {
    const adapter = new LLMInvestigationAdapter(
      new StubLLMTextClient({ error: new Error("Gemini timeout") }),
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(true);
    expect(report.confidence).toBe(0);
  });

  it("LLM応答がパース不能ならfallbackを返す（リトライしない）", async () => {
    const adapter = new LLMInvestigationAdapter(new StubLLMTextClient({ text: "壊れたJSON" }));

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(true);
  });
});
