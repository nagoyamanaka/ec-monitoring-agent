import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCard } from "./AlertCard";
import { makeAlert } from "../test-support/alertFixture";

describe("AlertCard", () => {
  it("eventName・source・summary を一覧行に表示する", () => {
    render(<AlertCard alert={makeAlert()} />);
    expect(screen.getByText("latency.spike")).toBeInTheDocument();
    expect(screen.getByText("ec-backend")).toBeInTheDocument();
    // summary は source と同じ行に省略表示される
    expect(screen.getByText(/未知のレイテンシ急増を検知/)).toBeInTheDocument();
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
    expect(screen.getByText(/確信度を算出中/)).toBeInTheDocument();
  });

  it("確信度がある alert は % を表示する", () => {
    render(<AlertCard alert={makeAlert()} />);
    // makeReport の confidence 0.82 → 82%
    expect(screen.getByText("82%")).toBeInTheDocument();
  });
});
