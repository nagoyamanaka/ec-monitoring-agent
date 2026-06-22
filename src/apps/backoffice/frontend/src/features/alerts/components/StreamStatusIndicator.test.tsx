import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StreamStatusIndicator } from "./StreamStatusIndicator";

describe("StreamStatusIndicator", () => {
  it("open: 緑「ライブ」を出し、最終更新もボタンも出さない", () => {
    render(
      <StreamStatusIndicator
        status="open"
        lastUpdatedAt={null}
      />,
    );
    expect(screen.getByText("ライブ")).toBeInTheDocument();
    expect(screen.queryByText(/最終更新/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("open + lastUpdatedAt: ライブ中は最終更新を隠す", () => {
    render(
      <StreamStatusIndicator
        status="open"
        lastUpdatedAt={new Date("2026-06-22T00:00:00Z")}
      />,
    );
    expect(screen.getByText("ライブ")).toBeInTheDocument();
    expect(screen.queryByText(/最終更新/)).not.toBeInTheDocument();
  });

  it("connecting: 「接続中…」を出す", () => {
    render(<StreamStatusIndicator status="connecting" lastUpdatedAt={null} />);
    expect(screen.getByText("接続中…")).toBeInTheDocument();
  });

  it("closed: 「切断」を出す", () => {
    render(<StreamStatusIndicator status="closed" lastUpdatedAt={null} />);
    expect(screen.getByText("切断")).toBeInTheDocument();
  });

  it("closed + onReconnect: 「再接続」ボタンを出し、クリックでコールバックを呼ぶ", async () => {
    const onReconnect = vi.fn();
    render(
      <StreamStatusIndicator
        status="closed"
        lastUpdatedAt={null}
        onReconnect={onReconnect}
      />,
    );
    const btn = screen.getByRole("button", { name: "再接続" });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it("closed + onReconnect なし: 再接続ボタンを出さない", () => {
    render(<StreamStatusIndicator status="closed" lastUpdatedAt={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("connecting + lastUpdatedAt: 最終更新と絶対時刻 title を出す", () => {
    const ts = new Date("2026-06-22T05:30:00Z");
    render(
      <StreamStatusIndicator status="connecting" lastUpdatedAt={ts} />,
    );
    const span = screen.getByText(/最終更新/);
    expect(span).toBeInTheDocument();
    expect(span).toHaveAttribute("title", ts.toLocaleString());
  });

  it("open + onReconnect: ライブ中は切断でないのでボタンを出さない", () => {
    render(
      <StreamStatusIndicator
        status="open"
        lastUpdatedAt={null}
        onReconnect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
