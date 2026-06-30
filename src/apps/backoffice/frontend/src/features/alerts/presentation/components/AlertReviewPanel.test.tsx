import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertReviewPanel } from "./AlertReviewPanel";
import { makeAlert } from "../../test-support/alertFixture";

describe("AlertReviewPanel", () => {
  it("承認は単一クリックで onDecision(approve) を呼ぶ", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(<AlertReviewPanel alert={makeAlert({ id: "a-9" })} onDecision={onDecision} />);

    await userEvent.click(screen.getByRole("button", { name: /承認/ }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "approve", undefined);
  });

  it("却下は note 入力を開き、note 付きで onDecision(reject) を呼ぶ", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(<AlertReviewPanel alert={makeAlert({ id: "a-9" })} onDecision={onDecision} />);

    // 却下クリックで理由入力パネルが開く（即時送信はしない）
    await userEvent.click(screen.getByRole("button", { name: "✗ 却下" }));
    expect(onDecision).not.toHaveBeenCalled();

    // note 空のうちは送信不可
    const submit = screen.getByRole("button", { name: "却下する" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/何が違うか/), "原因は在庫サービス");
    await userEvent.click(screen.getByRole("button", { name: "却下する" }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "reject", "原因は在庫サービス");
  });

  it("「却下して AI 再調査」は note 付きで onReinvestigate を呼ぶ", async () => {
    const onReinvestigate = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertReviewPanel
        alert={makeAlert({ id: "a-9" })}
        onDecision={vi.fn()}
        onReinvestigate={onReinvestigate}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "✗ 却下" }));
    await userEvent.type(screen.getByLabelText(/何が違うか/), "閾値を見直して");
    await userEvent.click(screen.getByRole("button", { name: "却下して AI 再調査" }));
    expect(onReinvestigate).toHaveBeenCalledWith("a-9", "閾値を見直して");
  });

  it("onReinvestigate 未指定なら再調査ボタンを出さない", async () => {
    render(<AlertReviewPanel alert={makeAlert({ id: "a-9" })} onDecision={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "✗ 却下" }));
    expect(
      screen.queryByRole("button", { name: /AI 再調査/ }),
    ).not.toBeInTheDocument();
  });

  it("再調査中（ANALYZING）は判定を伏せる（何も描画しない）", () => {
    const { container } = render(
      <AlertReviewPanel
        alert={makeAlert({ id: "a-9", status: "ANALYZING" })}
        onDecision={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "✗ 却下" }),
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("承認済みは承認ボタンが選択状態（押下不可）で却下は押せる（トグル）", () => {
    render(<AlertReviewPanel alert={makeAlert({ feedback: { isCorrect: true } })} />);
    const approve = screen.getByRole("button", { name: /承認済み/ });
    expect(approve).toHaveAttribute("aria-pressed", "true");
    expect(approve).toBeDisabled();
    expect(screen.getByRole("button", { name: "✗ 却下" })).toBeEnabled();
  });

  it("承認済み→却下トグルで却下し直せる（note 付き onDecision(reject)）", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertReviewPanel
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
      <AlertReviewPanel
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
});
