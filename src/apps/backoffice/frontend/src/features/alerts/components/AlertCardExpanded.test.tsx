import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

  it("href 付き調査ステップは新規タブの外部リンクになる", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: makeReport({
            investigationSteps: [
              { text: "ログを見る", href: "https://logs.example/q", kind: "log" },
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
        alert={makeAlert({
          report: makeReport({ investigationSteps: [{ text: "素のステップ" }] }),
        })}
      />,
    );

    expect(screen.getByText("素のステップ")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /素のステップ/ }),
    ).not.toBeInTheDocument();
  });

  it("類似既知（SIMILARITY）は元の解決済み Alert への内部リンクを出す", () => {
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

    const link = screen.getByRole("link", { name: /過去の同型障害/ });
    expect(link).toHaveAttribute("href", "/alerts/alert-past-1");
  });

  it("sourceAlertId が無ければ内部リンクを出さない", () => {
    render(
      <MemoryRouter>
        <AlertCardExpanded
          alert={makeAlert({
            report: null,
            classification: {
              type: "known",
              source: "EXACT_MATCH",
              patternId: "p-1",
              patternName: "決済タイムアウト",
              confidence: 0.9,
              matchedConditions: [],
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("link", { name: /過去の同型障害/ }),
    ).not.toBeInTheDocument();
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
