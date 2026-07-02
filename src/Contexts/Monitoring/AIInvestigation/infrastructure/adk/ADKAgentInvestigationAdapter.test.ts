import { describe, it, expect } from "vitest";
import { ADKAgentInvestigationAdapter } from "./ADKAgentInvestigationAdapter.js";
import { InvestigationAgentRunner } from "./InvestigationAgentRunner.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { AlertSeverities } from "../../../Shared/domain/AlertSeverity.js";

const context: InvestigationContext = {
  errorEvent: {
    eventName: "PaymentTimeout",
    occurredOn: "2026-06-20T00:00:00.000Z",
    payload: {},
    severity: AlertSeverities.CRITICAL,
  },
  knownPatterns: [],
  similarIncidents: [],
};

/** エージェント・グラフ（ADK）を呼ばずにアダプタのオーケストレーションだけを検証するフェイク。 */
class FakeAgentRunner implements InvestigationAgentRunner {
  constructor(private readonly behavior: { text?: string; error?: Error }) {}
  async run(): Promise<string> {
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

describe("ADKAgentInvestigationAdapter", () => {
  it("エージェントの最終出力(JSON)をInvestigationReportに変換する", async () => {
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: validJson }),
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(false);
    expect(report.summary).toBe("DB接続枯渇");
    expect(report.severity.value).toBe(AlertSeverities.CRITICAL);
  });

  it("エージェント実行が例外を投げたらfallbackを返す", async () => {
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ error: new Error("adk run failed") }),
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(true);
    expect(report.confidence).toBe(0);
  });

  it("最終出力がパース不能ならfallbackを返す", async () => {
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: "壊れたJSON" }),
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(true);
  });

  it("パース不能でも収集済み証拠のリンクは fallback レポートに残す", async () => {
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: "壊れたJSON" }),
      { githubRepo: "example-org/ec-backend" },
    );

    const report = await adapter.investigate({
      ...context,
      infraEvidence: {
        appLogs: [],
        collectedAt: new Date("2026-06-20T00:00:00.000Z"),
        recentCommits: [
          { sha: "abc1234", message: "fix", author: "a", committedAt: new Date() },
        ],
      },
    });

    expect(report.isFallback).toBe(true);
    expect(report.investigationSteps).toEqual([
      {
        text: "コミット abc1234: fix",
        href: "https://github.com/example-org/ec-backend/commit/abc1234",
        kind: "code",
      },
    ]);
  });

  it("infraEvidence と linkConfig から証拠リンクを調査ステップへ追記する", async () => {
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: validJson }),
      { githubRepo: "example-org/ec-backend" },
    );

    const report = await adapter.investigate({
      ...context,
      infraEvidence: {
        appLogs: [],
        collectedAt: new Date("2026-06-20T00:00:00.000Z"),
        recentCommits: [
          { sha: "abc1234", message: "fix", author: "a", committedAt: new Date() },
        ],
      },
    });

    expect(report.investigationSteps).toEqual([
      "ログ確認",
      {
        text: "コミット abc1234: fix",
        href: "https://github.com/example-org/ec-backend/commit/abc1234",
        kind: "code",
      },
    ]);
  });
});
