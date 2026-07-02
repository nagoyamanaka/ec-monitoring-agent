import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertList } from "./AlertList";
import { makeAlert } from "../../test-support/alertFixture";

describe("AlertList", () => {
  it("loading 時はスケルトン（aria-busy）を出す", () => {
    const { container } = render(
      <AlertList
        alerts={[]}
        status="loading"
        error={null}
      />,
    );
    expect(container.querySelector("[aria-busy]")).toBeInTheDocument();
  });

  it("error 時は失敗メッセージを出し、生のエラー内容は折りたたみ詳細へ降格する", () => {
    render(
      <AlertList
        alerts={[]}
        status="error"
        error={new Error("HTTP 500 Internal Server Error")}
      />,
    );
    expect(screen.getByText(/取得に失敗/)).toBeInTheDocument();
    // 生エラーは <details> 配下（初期は折りたたみ）
    expect(screen.getByText("技術詳細")).toBeInTheDocument();
    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
  });

  it("自動リトライ中は再試行中の文言を出す", () => {
    render(
      <AlertList
        alerts={[]}
        status="error"
        retrying
        error={new Error("HTTP 500 Internal Server Error")}
      />,
    );
    expect(
      screen.getByText(/自動で再試行しています/),
    ).toBeInTheDocument();
  });

  it("リトライ使い切り後は再試行ボタンで onRetry を呼ぶ", async () => {
    const onRetry = vi.fn();
    render(
      <AlertList
        alerts={[]}
        status="error"
        retrying={false}
        onRetry={onRetry}
        error={new Error("HTTP 500")}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("ready かつ空ならデモ卓への CTA と確度スペクトルの説明を出す", () => {
    render(
      <AlertList
        alerts={[]}
        status="ready"
        error={null}
      />,
    );
    expect(
      screen.getByText(/アクティブなアラートはありません/),
    ).toBeInTheDocument();
    expect(screen.getByText(/デモ操作卓からシナリオを注入/)).toBeInTheDocument();
    expect(screen.getByText(/完全一致（確定）/)).toBeInTheDocument();
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
