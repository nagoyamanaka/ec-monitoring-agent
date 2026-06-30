import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AlertCardExpanded } from "./AlertCardExpanded";
import { makeAlert, makeReport } from "../../test-support/alertFixture";

describe("AlertCardExpanded", () => {
  it("full は サマリ・調査ステップ・推奨アクションを表示する", () => {
    render(<AlertCardExpanded alert={makeAlert()} variant="full" />);
    expect(screen.getByText("AI 推定パターン")).toBeInTheDocument();
    expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
    expect(screen.getByText("ログ確認")).toBeInTheDocument();
    expect(screen.getByText("ロールバック")).toBeInTheDocument();
  });

  it("href 付き調査ステップは新規タブの外部リンクになる", () => {
    render(
      <AlertCardExpanded
        variant="full"
        alert={makeAlert({
          report: makeReport({
            investigationSteps: [
              {
                text: "ログを見る",
                href: "https://logs.example/q",
                kind: "log",
              },
            ],
          }),
        })}
      />,
    );

    const link = screen.getByRole("link", { name: /ログを見る/ });
    expect(link).toHaveAttribute("href", "https://logs.example/q");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("href の無いステップはプレーンテキストのまま（リンク化しない）", () => {
    render(
      <AlertCardExpanded
        variant="full"
        alert={makeAlert({
          report: makeReport({
            investigationSteps: [{ text: "素のステップ" }],
          }),
        })}
      />,
    );

    expect(screen.getByText("素のステップ")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /素のステップ/ }),
    ).not.toBeInTheDocument();
  });

  it("類似既知（SIMILARITY）の back-link はここには出さない（関連アラートパネルへ統合）", () => {
    render(
      <MemoryRouter>
        <AlertCardExpanded
          alert={makeAlert({
            report: null,
            classification: {
              type: "known",
              source: "SIMILARITY",
              patternId: "similar:inc-1",
              patternName: "類似既知: 在庫予約失敗",
              confidence: 0.87,
              matchedConditions: [],
              sourceAlertId: "alert-past-1",
            },
          })}
        />
      </MemoryRouter>,
    );

    // back-link は RelatedAlertsPanel（ドロワー/詳細でマウント）へ移設済み。
    expect(
      screen.queryByRole("link", { name: /過去の同型障害|詳細を開く/ }),
    ).not.toBeInTheDocument();
  });

  it("remediable=true のとき「コードで修正可能」バッジを出す（full）", () => {
    const { rerender } = render(
      <AlertCardExpanded
        variant="full"
        alert={makeAlert({ report: makeReport({ remediable: false }) })}
      />,
    );
    expect(screen.queryByText(/コードで修正可能/)).not.toBeInTheDocument();

    rerender(
      <AlertCardExpanded
        variant="full"
        alert={makeAlert({ report: makeReport({ remediable: true }) })}
      />,
    );
    expect(screen.getByText(/コードで修正可能/)).toBeInTheDocument();
  });

  it("既知パターンは該当パターン名と一致根拠を表示する", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: null,
          classification: {
            type: "known",
            source: "EXACT_MATCH",
            patternId: "p-1",
            patternName: "決済APIタイムアウト",
            confidence: 0.9,
            matchedConditions: [
              {
                field: "eventName",
                expectedValue: "ec.payment.timeout",
                actualValue: "ec.payment.timeout",
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("該当パターン（既知）")).toBeInTheDocument();
    expect(screen.getByText("決済APIタイムアウト")).toBeInTheDocument();
    expect(screen.getByText("一致した根拠")).toBeInTheDocument();
    expect(screen.getByText("eventName")).toBeInTheDocument();
  });

  // 分類レビュー（承認/却下/再調査）UI は AlertReviewPanel に分離した
  // （末尾配置の統一・AlertReviewPanel.test.tsx で網羅）。ここでは扱わない。
  it("再調査中（ANALYZING かつ既存内容あり）はバナーを出す", () => {
    render(
      <AlertCardExpanded alert={makeAlert({ id: "a-9", status: "ANALYZING" })} />,
    );
    expect(screen.getByText(/再調査中/)).toBeInTheDocument();
  });

  it("レポート未到着（分析中）はプレースホルダを出す", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({ status: "ANALYZING", report: null })}
      />,
    );
    expect(screen.getByText(/調査中/)).toBeInTheDocument();
  });

  // タスク37: 同一 InvestigationReport を射影違いで出し分ける（要約 vs 報告用フル）。
  describe("射影（variant: summary / full）", () => {
    const fullReport = makeReport({
      impact: {
        fault: "external",
        scope: "決済導線の一部ユーザ",
        scale: "約1,200件・15分継続",
        affectedSubjects: ["payment-api", "checkout"],
        citations: ["log:err-503", "inc:past-42"],
      },
      escalation: {
        team: "external-vendor-liaison",
        owner: "oncall-vendor",
        contact: "#vendor-escalation",
        reason: "外部決済APIの 5xx 急増が根本原因",
        interimWorkaround: "リトライ間隔を延ばし二重課金を防ぐ",
        severityRationale: "売上直結のため high",
        evidenceBundle: ["log:err-503"],
      },
      remediationReview: {
        verdict: "concerns",
        concerns: ["テストが障害経路をカバーしていない"],
        pullRequestUrl: "https://github.com/acme/repo/pull/7",
        citations: ["diff:src/pay.ts"],
      },
    });

    it("summary は要約のみ（impact.scale は出すが調査ステップ/推奨アクション/escalation/review は出さない）", () => {
      render(
        <AlertCardExpanded
          variant="summary"
          alert={makeAlert({ report: fullReport })}
        />,
      );
      // 要約に出るもの: サマリ文＋障害規模
      expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
      expect(screen.getByText("約1,200件・15分継続")).toBeInTheDocument();
      // 重い証跡・報告用フルは出さない
      expect(screen.queryByText("調査ステップ")).not.toBeInTheDocument();
      expect(screen.queryByText("推奨アクション")).not.toBeInTheDocument();
      expect(screen.queryByText("影響評価")).not.toBeInTheDocument();
      expect(
        screen.queryByText("エスカレーション草案"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("修正PR 自動レビュー")).not.toBeInTheDocument();
    });

    it("full は報告用フル（impact 全項目・escalation・review を全表示）", () => {
      render(
        <AlertCardExpanded
          variant="full"
          alert={makeAlert({ report: fullReport })}
        />,
      );
      // impact 全項目
      expect(screen.getByText("影響評価")).toBeInTheDocument();
      expect(screen.getByText(/他責/)).toBeInTheDocument();
      expect(screen.getByText("決済導線の一部ユーザ")).toBeInTheDocument();
      expect(screen.getByText("約1,200件・15分継続")).toBeInTheDocument();
      expect(screen.getByText("payment-api")).toBeInTheDocument();
      expect(screen.getByText("inc:past-42")).toBeInTheDocument();
      // escalation
      expect(screen.getByText("エスカレーション草案")).toBeInTheDocument();
      expect(screen.getByText("external-vendor-liaison")).toBeInTheDocument();
      // review
      expect(screen.getByText("修正PR 自動レビュー")).toBeInTheDocument();
      expect(screen.getByText(/concerns/)).toBeInTheDocument();
      expect(
        screen.getByText("テストが障害経路をカバーしていない"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /レビュー対象 PR/ }),
      ).toHaveAttribute("href", "https://github.com/acme/repo/pull/7");
    });

    it("impact/escalation/review の無い旧 Alert でも両 variant で壊れない", () => {
      const plain = makeReport(); // impact 等を持たない既定レポート
      const { rerender } = render(
        <AlertCardExpanded variant="summary" alert={makeAlert({ report: plain })} />,
      );
      expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
      expect(screen.queryByText("障害規模")).not.toBeInTheDocument();
      expect(screen.queryByText("影響評価")).not.toBeInTheDocument();

      rerender(
        <AlertCardExpanded variant="full" alert={makeAlert({ report: plain })} />,
      );
      // full でも欠落フィールドのパネルは描画しない（調査ステップは出る）
      expect(screen.getByText("調査ステップ")).toBeInTheDocument();
      expect(screen.queryByText("影響評価")).not.toBeInTheDocument();
      expect(
        screen.queryByText("エスカレーション草案"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("修正PR 自動レビュー")).not.toBeInTheDocument();
    });
  });
});
