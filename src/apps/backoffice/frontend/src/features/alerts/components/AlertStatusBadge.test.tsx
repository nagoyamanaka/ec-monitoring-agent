import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertStatusBadge } from "./AlertStatusBadge";
import { makeAlert } from "../test-support/alertFixture";

describe("AlertStatusBadge", () => {
  it("分析中を表示する", () => {
    render(
      <AlertStatusBadge alert={makeAlert({ status: "ANALYZING", report: null })} />,
    );
    expect(screen.getByText("分析中")).toBeInTheDocument();
  });

  it("レビュー待ち / 承認済み / 却下済みを feedback から導出する", () => {
    const { rerender } = render(
      <AlertStatusBadge alert={makeAlert({ feedback: null })} />,
    );
    expect(screen.getByText("レビュー待ち")).toBeInTheDocument();

    rerender(
      <AlertStatusBadge alert={makeAlert({ feedback: { isCorrect: true } })} />,
    );
    expect(screen.getByText("承認済み")).toBeInTheDocument();

    rerender(
      <AlertStatusBadge alert={makeAlert({ feedback: { isCorrect: false } })} />,
    );
    expect(screen.getByText("却下済み")).toBeInTheDocument();
  });

  it("既知パターン（report 無し・未レビュー）もレビュー待ち（未調査とは出さない）", () => {
    render(<AlertStatusBadge alert={makeAlert({ report: null, feedback: null })} />);
    expect(screen.getByText("レビュー待ち")).toBeInTheDocument();
    expect(screen.queryByText("未調査")).not.toBeInTheDocument();
  });
});
