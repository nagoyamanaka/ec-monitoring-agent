import { describe, it, expect } from "vitest";
import { ADKAgentInvestigationAdapter } from "./ADKAgentInvestigationAdapter.js";
import type {
  InvestigationAgentRunner,
  InvestigationAgentRunResult,
} from "./InvestigationAgentRunner.js";
import {
  EMPTY_TOOL_OBSERVED_EVIDENCE,
  type ToolObservedEvidence,
} from "../../domain/ToolObservedEvidence.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { AlertSeverities } from "../../../Shared/domain/AlertSeverity.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { StructuredLog } from "../../../../Shared/domain/logging/StructuredLog.js";

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
  lastOptions: { alertId?: string } | undefined;
  calls = 0;
  constructor(
    private readonly behavior: {
      text?: string;
      error?: Error;
      toolObservedEvidence?: ToolObservedEvidence;
    },
  ) {}
  async run(
    _seedPrompt: string,
    options?: { alertId?: string },
  ): Promise<InvestigationAgentRunResult> {
    this.calls++;
    this.lastOptions = options;
    if (this.behavior.error) throw this.behavior.error;
    return {
      text: this.behavior.text ?? "",
      toolObservedEvidence:
        this.behavior.toolObservedEvidence ?? EMPTY_TOOL_OBSERVED_EVIDENCE,
    };
  }
}

class RecordingLogger extends Logger {
  logs: StructuredLog[] = [];
  async write(log: StructuredLog): Promise<void> {
    this.logs.push(log);
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

  it("context.alertId を進行イベント相関キーとして runner へ引き渡す（未設定なら渡さない）", async () => {
    const withId = new FakeAgentRunner({ text: validJson });
    await new ADKAgentInvestigationAdapter(withId).investigate({
      ...context,
      alertId: "alert-1",
    });
    expect(withId.lastOptions).toEqual({ alertId: "alert-1" });

    const withoutId = new FakeAgentRunner({ text: validJson });
    await new ADKAgentInvestigationAdapter(withoutId).investigate(context);
    expect(withoutId.lastOptions).toBeUndefined();
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

  it("最終出力が途中切断されたJSONなら fallback でなく部分レポートを回収する（タスク I1）", async () => {
    // アプリコード退行シナリオ実発生系: 正しい JSON が値文字列の途中で切断されている
    const truncated = validJson.slice(0, validJson.indexOf('"DB_CONNECTION_EXHAUSTION"') + 5);
    const logger = new RecordingLogger();
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: truncated }),
      undefined,
      logger,
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(false);
    expect(report.summary).toBe("DB接続枯渇");
    expect(report.confidence).toBe(0.87);
    expect(report.severity.value).toBe(AlertSeverities.CRITICAL);
    // 回収した事実は Cloud Logging で追えること（切断頻度の観測点）
    expect(logger.logs.map((l) => l.action)).toContain("ai_investigation_salvaged");
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

  it("1回目が空応答なら縮退リトライで成功レポートを返し、retry を Cloud Logging で追える", async () => {
    // fallback 第6原因の実発生系: 思考が出力予算を食い潰し finalText が0文字（切断ですらない）。
    const logger = new RecordingLogger();
    const retryRunner = new FakeAgentRunner({ text: validJson });
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: "" }),
      undefined,
      logger,
      retryRunner,
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(false);
    expect(report.summary).toBe("DB接続枯渇");
    expect(retryRunner.calls).toBe(1);
    expect(logger.logs.map((l) => l.action)).toContain("ai_investigation_retrying");
  });

  it("1回目が runner 例外でも縮退リトライで復帰する（瞬断も一過性として扱う）", async () => {
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ error: new Error("transient") }),
      undefined,
      undefined,
      new FakeAgentRunner({ text: validJson }),
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(false);
    expect(report.summary).toBe("DB接続枯渇");
  });

  it("縮退リトライも失敗したら fallback（再実行は1回で有界＝HOLブロッキングを広げない）", async () => {
    const retryRunner = new FakeAgentRunner({ text: "壊れたJSON" });
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: "" }),
      undefined,
      undefined,
      retryRunner,
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(true);
    expect(report.confidence).toBe(0);
    expect(retryRunner.calls).toBe(1);
  });

  it("1回目が成功したら縮退リトライは呼ばない（正常系のコスト・遅延を増やさない）", async () => {
    const retryRunner = new FakeAgentRunner({ text: validJson });
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: validJson }),
      undefined,
      undefined,
      retryRunner,
    );

    const report = await adapter.investigate(context);

    expect(report.isFallback).toBe(false);
    expect(retryRunner.calls).toBe(0);
  });

  it("infraEvidence と linkConfig から、AI が引用した sha の証拠リンクだけ調査ステップへ追記する", async () => {
    // summary が abc1234 を引用＝残る。def5678 は引用なし＝落ちる（全件連結ノイズの抑止）。
    const citedJson = JSON.stringify({
      ...JSON.parse(validJson),
      summary: "abc1234 の修正コミットが原因",
    });
    const adapter = new ADKAgentInvestigationAdapter(
      new FakeAgentRunner({ text: citedJson }),
      { githubRepo: "example-org/ec-backend" },
    );

    const report = await adapter.investigate({
      ...context,
      infraEvidence: {
        appLogs: [],
        collectedAt: new Date("2026-06-20T00:00:00.000Z"),
        recentCommits: [
          { sha: "abc1234", message: "fix", author: "a", committedAt: new Date() },
          { sha: "def5678", message: "Merge pull request #6", author: "a", committedAt: new Date() },
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

  describe("ツールが実取得した証拠も引用照合の語彙に入る（事前収集に無い証拠）", () => {
    // 事前収集（infraEvidence）はゼロ＝従来なら相関は全て落ち、引用は未照合だった。
    const relatedJson = (citation: string) =>
      JSON.stringify({
        ...JSON.parse(validJson),
        relatedAlerts: [
          {
            alertId: "alert-2",
            relation: "same_root_cause",
            rationale: "同じコミットを共有",
            citations: [citation],
          },
        ],
        impact: {
          fault: "internal",
          scope: "決済",
          scale: "全件",
          affectedSubjects: ["payment"],
          citations: [citation],
        },
      });
    const observed: ToolObservedEvidence = {
      commits: [{ sha: "c0ffee1234", url: "https://github.com/o/r/commit/c0ffee1234" }],
      terraformDiffs: [],
    };

    it("ツールが返した sha を引く相関は残り、引用は commit として照合済みになる", async () => {
      const adapter = new ADKAgentInvestigationAdapter(
        new FakeAgentRunner({
          text: relatedJson("commit c0ffee1234"),
          toolObservedEvidence: observed,
        }),
      );

      const report = await adapter.investigate(context);

      expect(report.relatedAlerts.map((r) => r.alertId)).toEqual(["alert-2"]);
      expect(report.impact?.citationRefs).toEqual([
        {
          value: "commit c0ffee1234",
          kind: "commit",
          href: "https://github.com/o/r/commit/c0ffee1234",
        },
      ]);
    });

    it("ツールが返していない sha（AI の捏造）を引く相関は落ち、引用は未照合のまま", async () => {
      const adapter = new ADKAgentInvestigationAdapter(
        new FakeAgentRunner({
          text: relatedJson("commit deadbeef99"),
          toolObservedEvidence: observed,
        }),
      );

      const report = await adapter.investigate(context);

      expect(report.relatedAlerts).toEqual([]);
      expect(report.impact?.citationRefs).toEqual([{ value: "commit deadbeef99" }]);
    });

    it("語彙は attempt ごと: 1回目のツール取得は縮退リトライの照合に持ち越さない", async () => {
      const adapter = new ADKAgentInvestigationAdapter(
        new FakeAgentRunner({ text: "", toolObservedEvidence: observed }),
        undefined,
        undefined,
        new FakeAgentRunner({ text: relatedJson("commit c0ffee1234") }),
      );

      const report = await adapter.investigate(context);

      expect(report.isFallback).toBe(false);
      expect(report.relatedAlerts).toEqual([]);
    });
  });
});
