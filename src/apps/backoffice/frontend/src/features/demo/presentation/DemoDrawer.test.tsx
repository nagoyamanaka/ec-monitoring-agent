import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoDrawer } from "./DemoDrawer";
import type { DemoApi, DemoStatus } from "../infrastructure/demoApi";
import { HttpError } from "@shared/api/HttpClient";

function status(overrides: Partial<DemoStatus> = {}): DemoStatus {
  return {
    demoEnabled: true,
    totalAlerts: 5,
    activeAlerts: 5,
    promotedPatternCount: 1,
    patternCount: 4,
    ...overrides,
  };
}

function fakeApi(overrides: Partial<DemoApi> = {}): DemoApi {
  return {
    getStatus: vi.fn().mockResolvedValue(status()),
    triggerScenario: vi
      .fn()
      .mockResolvedValue({
        scenarioId: "1",
        label: "決済タイムアウト",
        orderId: "o-1",
      }),
    reset: vi.fn().mockResolvedValue({ alertsSeeded: 5, patternsSeeded: 4 }),
    ...overrides,
  };
}

describe("DemoDrawer", () => {
  it("DEMO 無効（status 404）なら何も描画しない", async () => {
    const api = fakeApi({
      getStatus: vi
        .fn()
        .mockRejectedValue(new HttpError(404, "Not Found", null)),
    });
    const { container } = render(<DemoDrawer api={api} />);

    await waitFor(() => expect(api.getStatus).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("件数とシナリオボタンを描画する", async () => {
    render(<DemoDrawer api={fakeApi()} />);

    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());
    expect(screen.getByText("決済タイムアウト")).toBeInTheDocument();
    // app 枠は 完全一致/類似/未知 の3段。類似（準・既知）シナリオが出る（障害名で表示）。
    expect(screen.getByText("DBコネクションプール枯渇")).toBeInTheDocument();
    expect(screen.getByText("在庫競合")).toBeInTheDocument();
  });

  it("シナリオ行を開いてトリガーで triggerScenario を呼ぶ", async () => {
    const api = fakeApi();
    render(<DemoDrawer api={api} />);
    await waitFor(() =>
      expect(screen.getByText("決済タイムアウト")).toBeInTheDocument(),
    );

    // 行クリックはパネルを開くだけ（トリガーは開いたパネル内の実行ボタン）。
    await userEvent.click(
      screen.getByRole("button", { name: /決済タイムアウト/ }),
    );
    expect(api.triggerScenario).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "決済タイムアウト を実行" }),
    );
    expect(api.triggerScenario).toHaveBeenCalledWith("1");
  });

  it("リセット押下で reset を呼ぶ", async () => {
    const api = fakeApi();
    render(<DemoDrawer api={api} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "デモをリセット" }),
      ).toBeEnabled(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "デモをリセット" }),
    );
    expect(api.reset).toHaveBeenCalled();
  });
});
