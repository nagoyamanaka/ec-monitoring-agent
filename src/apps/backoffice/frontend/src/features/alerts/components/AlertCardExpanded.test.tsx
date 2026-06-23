import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCardExpanded } from "./AlertCardExpanded";
import { makeAlert, makeReport } from "../test-support/alertFixture";

describe("AlertCardExpanded", () => {
  it("AI 調査（未知）はサマリ・調査ステップ・推奨アクションを表示する", () => {
    render(<AlertCardExpanded alert={makeAlert()} />);
    expect(screen.getByText("AI 推定パターン")).toBeInTheDocument();
    expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
    expect(screen.getByText("ログ確認")).toBeInTheDocument();
    expect(screen.getByText("ロールバック")).toBeInTheDocument();
  });

  it("remediable=true のとき「コードで修正可能」バッジを出す", () => {
    const { rerender } = render(
      <AlertCardExpanded alert={makeAlert({ report: makeReport({ remediable: false }) })} />,
    );
    expect(screen.queryByText(/コードで修正可能/)).not.toBeInTheDocument();

    rerender(
      <AlertCardExpanded alert={makeAlert({ report: makeReport({ remediable: true }) })} />,
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
              { field: "eventName", expectedValue: "ec.payment.timeout", actualValue: "ec.payment.timeout" },
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

  it("承認/却下ボタンが decision 付きで onDecision を呼ぶ", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertCardExpanded alert={makeAlert({ id: "a-9" })} onDecision={onDecision} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /承認/ }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "approve");

    await userEvent.click(screen.getByRole("button", { name: /却下/ }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "reject");
  });

  it("レビュー済み（feedback あり）はボタンを出さずステータスを表示する", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({ feedback: { isCorrect: true } })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /承認/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("承認済み")).toBeInTheDocument();
  });

  it("レポート未到着（分析中）はプレースホルダを出す", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({ status: "ANALYZING", report: null })}
      />,
    );
    expect(screen.getByText(/調査中/)).toBeInTheDocument();
  });
});
