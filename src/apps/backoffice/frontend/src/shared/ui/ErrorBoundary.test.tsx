import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("子が throw すると全画面アンマウントでなく局所フォールバック板を出す", () => {
    // React が throw を stderr に吐くのを黙らせる（テスト出力を汚さない）。
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("この画面の表示に失敗しました"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
    spy.mockRestore();
  });

  it("throw が無ければ子をそのまま描く", () => {
    render(
      <ErrorBoundary>
        <p>正常</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
