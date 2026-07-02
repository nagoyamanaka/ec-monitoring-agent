import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertsHeader } from "./AlertsHeader";
import { makeAlert } from "../../test-support/alertFixture";

describe("AlertsHeader", () => {
  it("画面の説明文を常に出す", () => {
    render(<AlertsHeader alerts={[]} status="loading" />);
    expect(screen.getByText(/レビュー一覧/)).toBeInTheDocument();
  });

  it("loading 中は件数サマリを出さない", () => {
    render(<AlertsHeader alerts={[]} status="loading" />);
    expect(screen.queryByText(/レビュー待ち/)).not.toBeInTheDocument();
  });

  it("ready で actionable な件数（レビュー待ち・CRITICAL）を集計表示し、総件数は出さない", () => {
    render(
      <AlertsHeader
        status="ready"
        alerts={[
          makeAlert({
            id: "a",
            severity: "CRITICAL",
            feedback: null,
          }),
          makeAlert({
            id: "b",
            severity: "WARNING",
            feedback: { isCorrect: true },
          }),
        ]}
      />,
    );
    expect(screen.getByText("CRITICAL 1件")).toBeInTheDocument();
    expect(screen.getByText("レビュー待ち 1件")).toBeInTheDocument();
    // 総件数チップ（例: "2 件"）は出さない
    expect(screen.queryByText(/^\d+ 件$/)).not.toBeInTheDocument();
  });

  it("既知パターン（report 無し）の未レビューもカードバッジと同じ基準でレビュー待ちに数える", () => {
    // バグ再発防止: report.reviewStatus で数えると既知アラートが常に 0 件になり、
    // カードの「レビュー待ち」バッジとチップ集計が矛盾する。
    render(
      <AlertsHeader
        status="ready"
        alerts={[
          makeAlert({
            id: "known-1",
            classification: {
              type: "known",
              source: "EXACT_MATCH",
              patternId: "p-1",
              patternName: "DB接続枯渇",
              confidence: 1,
              matchedConditions: [],
            },
            report: null,
            feedback: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText("レビュー待ち 1件")).toBeInTheDocument();
  });

  it("分析中はレビュー待ちに数えない", () => {
    render(
      <AlertsHeader
        status="ready"
        alerts={[
          makeAlert({
            id: "a",
            status: "ANALYZING",
            report: null,
            feedback: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText("レビュー待ち 0件")).toBeInTheDocument();
    expect(screen.getByText("分析中 1件")).toBeInTheDocument();
  });

  it("分析中があれば件数を出す", () => {
    render(
      <AlertsHeader
        status="ready"
        alerts={[makeAlert({ id: "a", status: "ANALYZING", report: null })]}
      />,
    );
    expect(screen.getByText("分析中 1件")).toBeInTheDocument();
  });
});
