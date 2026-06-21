import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertList } from "./AlertList";
import { makeAlert } from "../test-support/alertFixture";

describe("AlertList", () => {
  it("loading 時はスケルトン（aria-busy）を出す", () => {
    const { container } = render(
      <AlertList alerts={[]} status="loading" error={null} />,
    );
    expect(container.querySelector("[aria-busy]")).toBeInTheDocument();
  });

  it("error 時は失敗メッセージとエラー内容を出す", () => {
    render(
      <AlertList alerts={[]} status="error" error={new Error("boom")} />,
    );
    expect(screen.getByText(/取得に失敗/)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it("ready かつ空なら空表示を出す", () => {
    render(<AlertList alerts={[]} status="ready" error={null} />);
    expect(
      screen.getByText(/アクティブなアラートはありません/),
    ).toBeInTheDocument();
  });

  it("一覧を順序どおり描画する", () => {
    render(
      <AlertList
        status="ready"
        error={null}
        alerts={[
          makeAlert({ id: "a", eventName: "latency.spike" }),
          makeAlert({ id: "b", eventName: "cpu.high" }),
        ]}
      />,
    );
    expect(screen.getByText("latency.spike")).toBeInTheDocument();
    expect(screen.getByText("cpu.high")).toBeInTheDocument();
  });

  it("行クリックで onSelect を呼ぶ", async () => {
    const onSelect = vi.fn();
    render(
      <AlertList
        status="ready"
        error={null}
        onSelect={onSelect}
        alerts={[makeAlert({ id: "a", eventName: "latency.spike" })]}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});
