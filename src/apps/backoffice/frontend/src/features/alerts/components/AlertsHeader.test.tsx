import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertsHeader } from "./AlertsHeader";
import { makeAlert, makeReport } from "../test-support/alertFixture";

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
            report: makeReport({ reviewStatus: "PENDING_REVIEW" }),
          }),
          makeAlert({
            id: "b",
            severity: "WARNING",
            report: makeReport({ reviewStatus: "APPROVED" }),
          }),
        ]}
      />,
    );
    expect(screen.getByText("CRITICAL 1件")).toBeInTheDocument();
    expect(screen.getByText("レビュー待ち 1件")).toBeInTheDocument();
    // 総件数チップ（例: "2 件"）は出さない
    expect(screen.queryByText(/^\d+ 件$/)).not.toBeInTheDocument();
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
