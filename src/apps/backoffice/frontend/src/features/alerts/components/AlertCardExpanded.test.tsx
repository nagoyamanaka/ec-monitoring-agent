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
      <AlertCardExpanded
        alert={makeAlert({ report: makeReport({ remediable: false }) })}
      />,
    );
    expect(screen.queryByText(/コードで修正可能/)).not.toBeInTheDocument();

    rerender(
      <AlertCardExpanded
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

  it("承認は単一クリックで onDecision(approve) を呼ぶ", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertCardExpanded
        alert={makeAlert({ id: "a-9" })}
        onDecision={onDecision}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /承認/ }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "approve", undefined);
  });

  it("却下は note 入力を開き、note 付きで onDecision(reject) を呼ぶ", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertCardExpanded
        alert={makeAlert({ id: "a-9" })}
        onDecision={onDecision}
      />,
    );

    // 却下クリックで理由入力パネルが開く（即時送信はしない）
    await userEvent.click(screen.getByRole("button", { name: "✗ 却下" }));
    expect(onDecision).not.toHaveBeenCalled();

    // note 空のうちは送信不可
    const submit = screen.getByRole("button", { name: "却下する" });
    expect(submit).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(/何が違うか/),
      "原因は在庫サービス",
    );
    await userEvent.click(screen.getByRole("button", { name: "却下する" }));
    expect(onDecision).toHaveBeenCalledWith(
      "a-9",
      "reject",
      "原因は在庫サービス",
    );
  });

  it("「却下して AI 再調査」は note 付きで onReinvestigate を呼ぶ", async () => {
    const onReinvestigate = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertCardExpanded
        alert={makeAlert({ id: "a-9" })}
        onDecision={vi.fn()}
        onReinvestigate={onReinvestigate}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "✗ 却下" }));
    await userEvent.type(screen.getByLabelText(/何が違うか/), "閾値を見直して");
    await userEvent.click(
      screen.getByRole("button", { name: "却下して AI 再調査" }),
    );
    expect(onReinvestigate).toHaveBeenCalledWith("a-9", "閾値を見直して");
  });

  it("onReinvestigate 未指定なら再調査ボタンを出さない", async () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({ id: "a-9" })}
        onDecision={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "✗ 却下" }));
    expect(
      screen.queryByRole("button", { name: /AI 再調査/ }),
    ).not.toBeInTheDocument();
  });

  it("再調査中（ANALYZING かつ既存内容あり）はバナーを出しレビュー操作を伏せる", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({ id: "a-9", status: "ANALYZING" })}
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText(/再調査中/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "✗ 却下" }),
    ).not.toBeInTheDocument();
  });

  it("承認済みは承認ボタンが選択状態（押下不可）で却下は押せる（トグル）", () => {
    render(
      <AlertCardExpanded alert={makeAlert({ feedback: { isCorrect: true } })} />,
    );
    const approve = screen.getByRole("button", { name: /承認済み/ });
    expect(approve).toHaveAttribute("aria-pressed", "true");
    expect(approve).toBeDisabled();
    expect(screen.getByRole("button", { name: "✗ 却下" })).toBeEnabled();
  });

  it("承認済み→却下トグルで却下し直せる（note 付き onDecision(reject)）", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertCardExpanded
        alert={makeAlert({ id: "a-9", feedback: { isCorrect: true } })}
        onDecision={onDecision}
      />,
    );

    // 反対側の「却下」を押すと理由入力へ
    await userEvent.click(screen.getByRole("button", { name: "✗ 却下" }));
    await userEvent.type(screen.getByLabelText(/何が違うか/), "誤承認だった");
    await userEvent.click(screen.getByRole("button", { name: "却下する" }));

    expect(onDecision).toHaveBeenCalledWith("a-9", "reject", "誤承認だった");
  });

  it("却下済み→承認トグルは1クリックで onDecision(approve)（却下理由も表示）", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertCardExpanded
        alert={makeAlert({
          id: "a-9",
          feedback: { isCorrect: false, operatorNote: "別原因だった" },
        })}
        onDecision={onDecision}
      />,
    );

    expect(screen.getByText(/別原因だった/)).toBeInTheDocument();
    const reject = screen.getByRole("button", { name: /却下済み/ });
    expect(reject).toHaveAttribute("aria-pressed", "true");
    expect(reject).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "✓ 承認" }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "approve", undefined);
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
