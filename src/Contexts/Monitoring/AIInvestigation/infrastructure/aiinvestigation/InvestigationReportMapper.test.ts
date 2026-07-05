import { describe, it, expect } from "vitest";
import { toInvestigationReport, buildFallbackReport } from "./InvestigationReportMapper.js";
import { LLMInvestigationOutput } from "./LLMOutputParser.js";
import { AlertSeverities } from "../../../Shared/domain/AlertSeverity.js";
import { ReviewStatuses } from "../../../AlertAnalysis/domain/ReviewStatus.js";

function output(overrides: Partial<LLMInvestigationOutput> = {}): LLMInvestigationOutput {
  return {
    summary: "DB接続枯渇",
    confidence: 0.87,
    severity: "CRITICAL",
    investigationSteps: ["ログ確認"],
    suggestedActions: ["プール拡張"],
    suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
    remediable: false,
    relatedAlerts: [],
    ...overrides,
  };
}

describe("InvestigationReportMapper", () => {
  describe("toInvestigationReport", () => {
    it("有効な出力をInvestigationReportへマッピングする", () => {
      const report = toInvestigationReport(output());
      expect(report.summary).toBe("DB接続枯渇");
      expect(report.severity.value).toBe(AlertSeverities.CRITICAL);
      expect(report.confidence).toBe(0.87);
      expect(report.isFallback).toBe(false);
      expect(report.reviewStatus.value).toBe(ReviewStatuses.PENDING_REVIEW);
      expect(report.remediable).toBe(false);
    });

    it("remediable を伝播する", () => {
      expect(toInvestigationReport(output({ remediable: true })).remediable).toBe(true);
    });

    it("confidenceを[0,1]にクランプする", () => {
      expect(toInvestigationReport(output({ confidence: 1.5 })).confidence).toBe(1);
      expect(toInvestigationReport(output({ confidence: -0.3 })).confidence).toBe(0);
    });

    it("severityの大文字小文字を吸収する", () => {
      expect(toInvestigationReport(output({ severity: "info" })).severity.value).toBe(AlertSeverities.INFO);
    });

    it("未知のseverityはWARNINGに丸める", () => {
      expect(toInvestigationReport(output({ severity: "FATAL" })).severity.value).toBe(AlertSeverities.WARNING);
    });

    it("引用された sha のコミットリンクだけを LLM ステップの末尾へ追記する", () => {
      const report = toInvestigationReport(
        output({
          summary: "e12b655 による float 演算退行",
          investigationSteps: ["ログ確認"],
        }),
        [
          { text: "コミット e12b655: perf", href: "https://github.com/o/r/commit/e12b655", kind: "code" },
          { text: "コミット 740498f: Merge pull request #6", href: "https://github.com/o/r/commit/740498f", kind: "code" },
        ],
      );

      expect(report.investigationSteps).toEqual([
        "ログ確認",
        { text: "コミット e12b655: perf", href: "https://github.com/o/r/commit/e12b655", kind: "code" },
      ]);
    });

    it("impact.citations の引用でもコミットリンクを残す", () => {
      const report = toInvestigationReport(
        output({
          impact: {
            fault: "own" as const,
            scope: "注文",
            scale: "全件",
            affectedSubjects: ["orders"],
            citations: ["commit e12b655 が原因"],
          },
        }),
        [{ text: "コミット e12b655: perf", href: "https://github.com/o/r/commit/e12b655", kind: "code" }],
      );
      expect(report.investigationSteps).toContainEqual(
        { text: "コミット e12b655: perf", href: "https://github.com/o/r/commit/e12b655", kind: "code" },
      );
    });

    it("どこにも引用されないコミットリンクは全て落とす（全件連結ノイズの抑止）", () => {
      const report = toInvestigationReport(output({ investigationSteps: ["ログ確認"] }), [
        { text: "コミット abc: m", href: "https://github.com/o/r/commit/abc", kind: "code" },
      ]);
      expect(report.investigationSteps).toEqual(["ログ確認"]);
    });

    it("コミット以外のリンク（Cloud Logging 等）は引用なしでも残す", () => {
      const logLink = {
        text: "Cloud Logging: svc の ERROR ログ",
        href: "https://console.cloud.google.com/logs/query;query=x?project=p",
        kind: "log" as const,
      };
      const report = toInvestigationReport(output(), [logLink]);
      expect(report.investigationSteps).toContainEqual(logLink);
    });

    it("evidence リンク未指定なら LLM ステップのみ", () => {
      const report = toInvestigationReport(output({ investigationSteps: ["ログ確認"] }));
      expect(report.investigationSteps).toEqual(["ログ確認"]);
    });

    it("impact 未指定なら report.impact は undefined", () => {
      expect(toInvestigationReport(output()).impact).toBeUndefined();
    });

    it("citations 付き impact は照合結果（citationRefs）を添付して伝播する", () => {
      const impact = {
        fault: "own" as const,
        scope: "決済の一部",
        scale: "5分で120件",
        affectedSubjects: ["payment"],
        citations: ["commit:abc"],
      };
      // カタログ未指定（既定空）＝全引用が未照合（kind 無し）のまま残る。
      expect(toInvestigationReport(output({ impact })).impact).toEqual({
        ...impact,
        citationRefs: [{ value: "commit:abc" }],
      });
    });

    it("impact.citations は証拠カタログと突合され、解決した引用に kind/href が付く", () => {
      const impact = {
        fault: "own" as const,
        scope: "決済の一部",
        scale: "5分で120件",
        affectedSubjects: ["payment"],
        citations: ["e12b655", "appLogs: 謎のログ"],
      };
      const report = toInvestigationReport(output({ impact }), [], [], [
        {
          id: "e12b655abc",
          kind: "commit",
          href: "https://github.com/acme/ec/commit/e12b655abc",
        },
      ]);
      expect(report.impact?.citationRefs).toEqual([
        {
          value: "e12b655",
          kind: "commit",
          href: "https://github.com/acme/ec/commit/e12b655abc",
        },
        { value: "appLogs: 謎のログ" },
      ]);
    });

    it("citations 空の impact は落とす（ハルシネーションガード）", () => {
      const report = toInvestigationReport(
        output({
          impact: {
            fault: "external",
            scope: "外部API",
            scale: "不明",
            affectedSubjects: ["payment"],
            citations: [],
          },
        }),
      );
      expect(report.impact).toBeUndefined();
    });

    it("escalation 未指定なら report.escalation は undefined", () => {
      expect(toInvestigationReport(output()).escalation).toBeUndefined();
    });

    it("team 付き escalation はそのまま伝播する（他責ルートの出口）", () => {
      const escalation = {
        team: "external-vendor-liaison",
        owner: "外部ベンダー窓口",
        contact: "#vendor-liaison",
        reason: "外部決済API起因で自社変更が無い",
        interimWorkaround: "決済リトライ間隔を延長",
        severityRationale: "決済3%失敗・P1",
        evidenceBundle: ["log:abc"],
      };
      // evidenceBundle にも照合結果（evidenceBundleRefs）が添付される（カタログ空＝未照合）。
      expect(toInvestigationReport(output({ escalation })).escalation).toEqual({
        ...escalation,
        evidenceBundleRefs: [{ value: "log:abc" }],
      });
    });

    it("team 空の escalation は落とす（宛先捏造ガード）", () => {
      const report = toInvestigationReport(
        output({
          escalation: {
            team: "",
            owner: "",
            contact: "",
            reason: "宛先不明",
            interimWorkaround: "",
            severityRationale: "",
            evidenceBundle: [],
          },
        }),
      );
      expect(report.escalation).toBeUndefined();
    });

    it("解決済み citation を持つ関連は残し、未解決 citation だけ除去する（相関ガード）", () => {
      // インフラ→アプリの正当相関: terraform アドレスと commit sha を共有証拠として指せる
      const report = toInvestigationReport(
        output({
          relatedAlerts: [
            {
              alertId: "infra-1",
              relation: "same_root_cause",
              rationale: "Cloud SQL 縮小の波及",
              citations: [
                "google_sql_database_instance.main の max_connections 縮小",
                "存在しない証拠", // 未解決 → citation だけ除去（関連は残る）
              ],
            },
          ],
        }),
        [],
        ["google_sql_database_instance.main", "e12b655"],
      );
      expect(report.relatedAlerts).toEqual([
        {
          alertId: "infra-1",
          relation: "same_root_cause",
          rationale: "Cloud SQL 縮小の波及",
          citations: ["google_sql_database_instance.main の max_connections 縮小"],
        },
      ]);
    });

    it("収集済み証拠に解決しない関連は丸ごと落とす（証拠のない因果の橋＝決済↔在庫の捏造）", () => {
      const report = toInvestigationReport(
        output({
          relatedAlerts: [
            // 他責障害（infraEvidence ゼロ）で同時発生アラートを根拠なく関連づけたケース:
            // citations 無し・語彙も空 → 構造的に落ちる
            { alertId: "inventory-1", relation: "upstream", rationale: "在庫競合→DB高負荷→決済タイムアウト" },
            { alertId: "inventory-2", relation: "upstream", rationale: "同上", citations: ["捏造の根拠"] },
          ],
        }),
        [],
        [],
      );
      expect(report.relatedAlerts).toEqual([]);
    });

    it("citation の照合は case-insensitive（sha の大文字引用も解決する）", () => {
      const report = toInvestigationReport(
        output({
          relatedAlerts: [
            { alertId: "app-1", relation: "downstream", rationale: "退行の波及", citations: ["コミット E12B655 を共有"] },
          ],
        }),
        [],
        ["e12b655"],
      );
      expect(report.relatedAlerts).toHaveLength(1);
    });

    it("remediationReview 未指定なら report.remediationReview は undefined", () => {
      expect(toInvestigationReport(output()).remediationReview).toBeUndefined();
    });

    it("pullRequestUrl 付き remediationReview はそのまま伝播する", () => {
      const remediationReview = {
        verdict: "concerns" as const,
        concerns: ["テストが障害経路をカバーしていない"],
        pullRequestUrl: "https://github.com/o/r/pull/42",
        citations: ["diff:src/payment.ts"],
      };
      expect(
        toInvestigationReport(output({ remediationReview })).remediationReview,
      ).toEqual(remediationReview);
    });

    it("pullRequestUrl 空の remediationReview は落とす（レビュー対象不明ガード）", () => {
      const report = toInvestigationReport(
        output({
          remediationReview: {
            verdict: "pass",
            concerns: [],
            pullRequestUrl: "",
            citations: [],
          },
        }),
      );
      expect(report.remediationReview).toBeUndefined();
    });
  });

  describe("buildFallbackReport", () => {
    it("isFallback=true・confidence=0・WARNINGのレポートを返す", () => {
      const report = buildFallbackReport();
      expect(report.isFallback).toBe(true);
      expect(report.confidence).toBe(0);
      expect(report.severity.value).toBe(AlertSeverities.WARNING);
      expect(report.reviewStatus.value).toBe(ReviewStatuses.PENDING_REVIEW);
      expect(report.suggestedActions.length).toBeGreaterThan(0);
    });

    it("fallback は evidence リンクを引用で絞らず全件温存する（失敗しても空にしない）", () => {
      const links = [
        { text: "コミット abc: m", href: "https://github.com/o/r/commit/abc", kind: "code" as const },
        { text: "コミット def: n", href: "https://github.com/o/r/commit/def", kind: "code" as const },
      ];
      expect(buildFallbackReport(links).investigationSteps).toEqual(links);
    });
  });
});
