import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCard } from "./AlertCard";
import { makeAlert } from "../test-support/alertFixture";

describe("AlertCard", () => {
  it("既定は折りたたみ、ヘッダクリックで展開する", async () => {
    render(<AlertCard alert={makeAlert()} />);
    // 折りたたみ時は展開ビューのサマリが出ていない
    expect(
      screen.queryByText("未知のレイテンシ急増を検知"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /latency\.spike/ }));
    expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
  });

  it("defaultExpanded で初期展開する", () => {
    render(<AlertCard alert={makeAlert()} defaultExpanded />);
    expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
  });

  it("分析中の alert はインジケータを出す", () => {
    render(<AlertCard alert={makeAlert({ status: "ANALYZING", report: null })} />);
    expect(screen.getByText("分析中")).toBeInTheDocument();
  });
});
