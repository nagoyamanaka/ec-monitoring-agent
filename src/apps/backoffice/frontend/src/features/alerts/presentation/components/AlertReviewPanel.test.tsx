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
    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    expect(onDecision).not.toHaveBeenCalled();

    // note 空のうちは送信不可
    const submit = screen.getByRole("button", { name: "却下する" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/何が違うか/), "原因は在庫サービス");
    await userEvent.click(screen.getByRole("button", { name: "却下する" }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "reject", "原因は在庫サービス");
  });

  it("却下入力はインライン展開（承認/却下トグルは残り、却下再クリックで閉じる）", async () => {
    render(<AlertReviewPanel alert={makeAlert({ id: "a-9" })} onDecision={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    // パネルは差し替わらず、トグル行が見えたまま下に理由入力が開く
    expect(screen.getByRole("button", { name: "承認" })).toBeInTheDocument();
    expect(screen.getByLabelText(/何が違うか/)).toBeInTheDocument();

    // 却下トグルをもう一度押すと閉じる（キャンセルと等価）
    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    expect(screen.queryByLabelText(/何が違うか/)).not.toBeInTheDocument();
  });

  it("承認成功で学習シグナルの確認メッセージを表示する", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(<AlertReviewPanel alert={makeAlert({ id: "a-9" })} onDecision={onDecision} />);

    await userEvent.click(screen.getByRole("button", { name: /承認/ }));
    expect(screen.getByText(/承認を記録しました/)).toBeInTheDocument();
  });

  it("却下のみ成功でも確認メッセージ（正答率への反映）を表示する＝承認と対称", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(<AlertReviewPanel alert={makeAlert({ id: "a-9" })} onDecision={onDecision} />);

    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    await userEvent.type(screen.getByLabelText(/何が違うか/), "別原因");
    await userEvent.click(screen.getByRole("button", { name: "却下する" }));

    expect(screen.getByText(/却下を記録しました/)).toBeInTheDocument();
    expect(screen.getByText(/分類正答率に反映/)).toBeInTheDocument();
    // 新規の却下（承認の訂正ではない）では撤回の文言は出さない
    expect(screen.queryByText(/撤回しました/)).not.toBeInTheDocument();
  });

  it("承認済み→却下の訂正では、類似学習・自動昇格の撤回まで表示する", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertReviewPanel
        alert={makeAlert({
          id: "a-9",
          feedback: { isCorrect: true, operatorNote: undefined },
        })}
        onDecision={onDecision}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    await userEvent.type(screen.getByLabelText(/何が違うか/), "誤承認だった");
    await userEvent.click(screen.getByRole("button", { name: "却下する" }));

    expect(onDecision).toHaveBeenCalledWith("a-9", "reject", "誤承認だった");
    expect(screen.getByText(/却下を記録しました/)).toBeInTheDocument();
    expect(
      screen.getByText(/類似学習・自動昇格は撤回しました/),
    ).toBeInTheDocument();
  });

  it("onDecision 失敗時はエラーを表示し、無言で戻らない", async () => {
    const onDecision = vi.fn().mockRejectedValue(new Error("boom"));
    render(<AlertReviewPanel alert={makeAlert({ id: "a-9" })} onDecision={onDecision} />);

    await userEvent.click(screen.getByRole("button", { name: /承認/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/送信に失敗しました/);
    // 再試行できる（送信中ロックが解けている）
    expect(screen.getByRole("button", { name: /承認/ })).toBeEnabled();
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

    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    await userEvent.type(screen.getByLabelText(/何が違うか/), "閾値を見直して");
    await userEvent.click(screen.getByRole("button", { name: "却下して AI 再調査" }));
    expect(onReinvestigate).toHaveBeenCalledWith("a-9", "閾値を見直して");
  });

  it("onReinvestigate 未指定なら再調査ボタンを出さない", async () => {
    render(<AlertReviewPanel alert={makeAlert({ id: "a-9" })} onDecision={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    expect(
      screen.queryByRole("button", { name: /AI 再調査/ }),
    ).not.toBeInTheDocument();
  });

  it("onReinvestigate 有では記録だけの却下は secondary『却下のみ（記録だけ）』になる", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertReviewPanel
        alert={makeAlert({ id: "a-9" })}
        onDecision={onDecision}
        onReinvestigate={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    await userEvent.type(screen.getByLabelText(/何が違うか/), "別原因");
    await userEvent.click(
      screen.getByRole("button", { name: "却下のみ（記録だけ）" }),
    );
    expect(onDecision).toHaveBeenCalledWith("a-9", "reject", "別原因");
  });

  it("再調査中（ANALYZING）は判定を伏せる（何も描画しない）", () => {
    const { container } = render(
      <AlertReviewPanel
        alert={makeAlert({ id: "a-9", status: "ANALYZING" })}
        onDecision={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "却下" }),
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("承認済みは承認ボタンが選択状態（押下不可）で却下は押せる（トグル）", () => {
    render(<AlertReviewPanel alert={makeAlert({ feedback: { isCorrect: true } })} />);
    const approve = screen.getByRole("button", { name: /承認済み/ });
    expect(approve).toHaveAttribute("aria-pressed", "true");
    expect(approve).toBeDisabled();
    expect(screen.getByRole("button", { name: "却下" })).toBeEnabled();
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
    await userEvent.click(screen.getByRole("button", { name: "却下" }));
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
    // 裸の理由 echo でなく「記録が何に効いているか」のラベル付き（E9）
    expect(
      screen.getByText(/誤分類として記録されています/),
    ).toBeInTheDocument();
    const reject = screen.getByRole("button", { name: /却下済み/ });
    expect(reject).toHaveAttribute("aria-pressed", "true");
    expect(reject).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "承認" }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "approve", undefined);
  });

  it("未承認では『既知パターンへ昇格』を出さない（承認後ゲート）", () => {
    // 既定 fixture は未知＋有効レポート＝昇格の材料は揃うが feedback は未着。
    render(
      <AlertReviewPanel
        alert={makeAlert({ id: "a-9", feedback: null })}
        onDecision={vi.fn()}
        onPromote={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /既知パターンへ昇格/ }),
    ).not.toBeInTheDocument();
  });

  it("承認済みなら『既知パターンへ昇格』を出し onPromote を呼ぶ", async () => {
    const onPromote = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertReviewPanel
        alert={makeAlert({ id: "a-9", feedback: { isCorrect: true } })}
        onDecision={vi.fn()}
        onPromote={onPromote}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /既知パターンへ昇格/ }),
    );
    expect(onPromote).toHaveBeenCalledWith("a-9");
  });

  it("承認済みの類似既知（SIMILARITY）＋有効レポートにも『既知パターンへ昇格』を出す", async () => {
    const onPromote = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertReviewPanel
        alert={makeAlert({
          id: "a-9",
          feedback: { isCorrect: true },
          classification: {
            type: "known",
            source: "SIMILARITY",
            patternId: "similar:inc-1",
            patternName: "類似既知: ec.db.connection_pool_exhausted",
            confidence: 0.67,
            matchedConditions: [],
          },
        })}
        onDecision={vi.fn()}
        onPromote={onPromote}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /既知パターンへ昇格/ }),
    );
    expect(onPromote).toHaveBeenCalledWith("a-9");
  });

  it("完全一致（EXACT_MATCH）既知は承認済みでも昇格ボタンを出さない（既に高速パス）", () => {
    render(
      <AlertReviewPanel
        alert={makeAlert({
          id: "a-9",
          feedback: { isCorrect: true },
          classification: {
            type: "known",
            source: "EXACT_MATCH",
            patternId: "p-1",
            patternName: "決済タイムアウト",
            confidence: 1,
            matchedConditions: [],
          },
        })}
        onDecision={vi.fn()}
        onPromote={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /既知パターンへ昇格/ }),
    ).not.toBeInTheDocument();
  });
});
