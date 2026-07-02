import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstRunGuide } from "./FirstRunGuide";

const DISMISS_KEY = "ec-monitoring-agent:first-run-guide:dismissed";

describe("FirstRunGuide", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("初回訪問では3ステップガイドを出す", () => {
    render(<FirstRunGuide />);
    expect(screen.getByText(/3ステップで学習ループ/)).toBeInTheDocument();
    expect(screen.getByText("① 障害を注入")).toBeInTheDocument();
    expect(screen.getByText("② AI の調査を見る")).toBeInTheDocument();
    expect(screen.getByText("③ 承認で学習")).toBeInTheDocument();
  });

  it("閉じると非表示になり localStorage に記録される", async () => {
    render(<FirstRunGuide />);
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByText(/3ステップで学習ループ/)).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  it("dismiss 済みなら描画しない（1回きり）", () => {
    localStorage.setItem(DISMISS_KEY, "1");
    const { container } = render(<FirstRunGuide />);
    expect(container.firstChild).toBeNull();
  });
});
