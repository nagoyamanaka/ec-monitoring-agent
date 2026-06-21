import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCard } from "./AlertCard";
import { makeAlert } from "../test-support/alertFixture";

describe("AlertCard", () => {
  it("カタログ未登録の eventName は主役にそのまま出す（フォールバック）", () => {
    render(<AlertCard alert={makeAlert()} />);
    expect(screen.getByText("latency.spike")).toBeInTheDocument();
    // 未知（report あり）は AI 推定パターン名を出す（summary ではなく patternName）
    expect(screen.getByText(/AI推定/)).toBeInTheDocument();
    expect(screen.getByText(/latency-spike/)).toBeInTheDocument();
  });

  it("カタログ登録済みの eventName は人間語タイトルを主役に出す", () => {
    render(<AlertCard alert={makeAlert({ eventName: "ec.payment.timeout" })} />);
    expect(screen.getByText("決済タイムアウト")).toBeInTheDocument();
  });

  it("category は人間語ラベルに変換して出す", () => {
    render(<AlertCard alert={makeAlert({ category: "APPLICATION" })} />);
    expect(screen.getByText("アプリ層")).toBeInTheDocument();
    expect(screen.queryByText("APPLICATION")).not.toBeInTheDocument();
  });

  it("分析中は重要度を判定中と出す", () => {
    render(
      <AlertCard alert={makeAlert({ status: "ANALYZING", report: null })} />,
    );
    expect(screen.getByText("重要度 判定中")).toBeInTheDocument();
  });

  it("クリックで onSelect を alert id 付きで呼ぶ", async () => {
    const onSelect = vi.fn();
    render(<AlertCard alert={makeAlert({ id: "a-9" })} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("a-9");
  });

  it("選択中は aria-pressed が立つ", () => {
    render(<AlertCard alert={makeAlert()} selected />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("分析中の alert はインジケータと算出中表示を出す", () => {
    render(
      <AlertCard alert={makeAlert({ status: "ANALYZING", report: null })} />,
    );
    expect(screen.getByText("分析中")).toBeInTheDocument();
    expect(screen.getByText(/算出中/)).toBeInTheDocument();
  });

  it("確信度がある alert は % を表示する", () => {
    render(<AlertCard alert={makeAlert()} />);
    // makeReport の confidence 0.82 → 82%
    expect(screen.getByText("82%")).toBeInTheDocument();
  });
});
