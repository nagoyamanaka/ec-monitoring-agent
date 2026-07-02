import { describe, expect, it } from "vitest";
import { reportTeaser } from "./reportTeaser";
import { makeReport } from "../test-support/alertFixture";

describe("reportTeaser", () => {
  it("レポートが無ければ null", () => {
    expect(reportTeaser(null)).toBeNull();
    expect(reportTeaser(undefined)).toBeNull();
  });

  it("調査ステップ・推奨アクションを件数付きチップにし、headline は推奨アクション先頭", () => {
    const teaser = reportTeaser(makeReport());
    expect(teaser).toEqual({
      headline: "ロールバック",
      chips: ["調査ステップ 2", "推奨アクション 2"],
    });
  });

  it("optional セクション（remediable/impact/escalation/review）は存在するものだけチップ化する", () => {
    const teaser = reportTeaser(
      makeReport({
        remediable: true,
        impact: {
          fault: "own",
          scope: "在庫予約",
          scale: "1件",
          affectedSubjects: [],
          citations: [],
        },
        escalation: {
          team: "SRE",
          owner: "oncall",
          contact: "#sre",
          reason: "外部起因",
          interimWorkaround: "リトライ",
          severityRationale: "決済影響",
          evidenceBundle: [],
        },
        remediationReview: {
          verdict: "pass",
          concerns: [],
          pullRequestUrl: "https://example.com/pr/1",
          citations: [],
        },
      }),
    );
    expect(teaser?.chips).toEqual([
      "調査ステップ 2",
      "推奨アクション 2",
      "コードで修正可能",
      "影響評価",
      "エスカレーション草案",
      "修正PRレビュー",
    ]);
  });

  it("推奨アクションが空でも他セクションがあればチップのみ（headline=null）", () => {
    const teaser = reportTeaser(makeReport({ suggestedActions: [] }));
    expect(teaser).toEqual({ headline: null, chips: ["調査ステップ 2"] });
  });

  it("詳細ページ限定コンテンツが皆無（summary のみ）なら null＝素のリンクへフォールバック", () => {
    expect(
      reportTeaser(
        makeReport({ investigationSteps: [], suggestedActions: [] }),
      ),
    ).toBeNull();
  });
});
