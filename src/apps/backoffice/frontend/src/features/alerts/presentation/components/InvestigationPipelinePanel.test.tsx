import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvestigationPipelinePanel } from "./InvestigationPipelinePanel";
import { makeAlert, makeReport } from "../../test-support/alertFixture";
import type { InvestigationProgressView } from "../../domain/investigationProgress";

const RUN_START = "2026-07-03T00:00:00.000Z";

function makeEvent(
  overrides: Partial<InvestigationProgressView> = {},
): InvestigationProgressView {
  return {
    alertId: "alert-1",
    agent: "evidence_collector",
    tool: "fetch_app_logs",
    at: "2026-07-03T00:00:10.000Z",
    ...overrides,
  };
}

const analyzingAlert = makeAlert({
  status: "ANALYZING",
  report: null,
  updatedAt: RUN_START,
});

describe("InvestigationPipelinePanel", () => {
  it("ANALYZING 中は経過タイマー・エージェント台帳・不確定プログレスを出す", () => {
    render(<InvestigationPipelinePanel alert={analyzingAlert} />);

    expect(
      screen.getByText("AI エージェントが自律調査中"),
    ).toBeInTheDocument();
    expect(screen.getByText(/経過 \d+:\d{2}/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    // 7 エージェントの台帳（役割の1行つき）
    expect(screen.getByText("Coordinator")).toBeInTheDocument();
    expect(screen.getByText("EvidenceCollector")).toBeInTheDocument();
    expect(screen.getByText("RemediationReviewer")).toBeInTheDocument();
    // 正直さの注記（実イベントのみ・確定は完了時）
    expect(
      screen.getByText(/実際のエージェント実行イベントのみ/),
    ).toBeInTheDocument();
  });

  it("進行イベントが届くとライブフィードに実イベントを表示し、最新のエージェントを実行中にする", () => {
    render(
      <InvestigationPipelinePanel
        alert={analyzingAlert}
        progress={[
          makeEvent({ agent: "evidence_collector", tool: "fetch_app_logs" }),
          makeEvent({
            agent: "investigation_coordinator",
            tool: "impact_triage",
            at: "2026-07-03T00:00:20.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Cloud Logging からログ取得")).toBeInTheDocument();
    expect(screen.getByText("ImpactTriage へ委譲")).toBeInTheDocument();
    // 最新イベントは委譲先（impact_triage）を実行中としてハイライト
    expect(screen.getByText("実行中")).toBeInTheDocument();
  });

  it("run 開始（updatedAt）より前の古いイベントはライブフィードに混ぜない", () => {
    render(
      <InvestigationPipelinePanel
        alert={analyzingAlert}
        progress={[
          makeEvent({
            tool: "fetch_terraform_diff",
            at: "2026-07-02T23:00:00.000Z", // 前回 run のイベント
          }),
        ]}
      />,
    );
    expect(
      screen.queryByText("Terraform 差分を確認"),
    ).not.toBeInTheDocument();
  });

  it("ANALYZING→完了 をライブで見届けたら調査ステップをタイムライン表示する", () => {
    const { rerender } = render(
      <InvestigationPipelinePanel alert={analyzingAlert} />,
    );

    rerender(
      <InvestigationPipelinePanel
        alert={makeAlert({
          status: "OPEN",
          report: makeReport({
            investigationSteps: [{ text: "ログ確認" }, { text: "コミット精査" }],
          }),
        })}
      />,
    );

    expect(
      screen.getByText("調査完了 — AI がたどったステップ"),
    ).toBeInTheDocument();
    expect(screen.getByText("ログ確認")).toBeInTheDocument();
    expect(screen.getByText("コミット精査")).toBeInTheDocument();
  });

  it("完了済みアラートを後から開いた場合（ライブで見届けていない）は何も出さない", () => {
    const { container } = render(
      <InvestigationPipelinePanel alert={makeAlert({ status: "OPEN" })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("showCompletionTimeline=false なら完了タイムラインを出さない（詳細ページの重複回避）", () => {
    const { rerender, container } = render(
      <InvestigationPipelinePanel
        alert={analyzingAlert}
        showCompletionTimeline={false}
      />,
    );
    rerender(
      <InvestigationPipelinePanel
        alert={makeAlert({ status: "OPEN" })}
        showCompletionTimeline={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
