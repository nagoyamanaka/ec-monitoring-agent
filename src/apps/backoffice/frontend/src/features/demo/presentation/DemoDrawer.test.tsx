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
    expect(screen.getByText("決済プロバイダ拒否")).toBeInTheDocument();
    // 未知（AI 調査）群のシナリオも出る。
    expect(screen.getByText("脆弱性検知")).toBeInTheDocument();
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

  it("refreshKey が変わると status を再取得する（SSE 着弾で件数追随）", async () => {
    const api = fakeApi();
    const { rerender } = render(<DemoDrawer api={api} refreshKey={null} />);
    await waitFor(() => expect(api.getStatus).toHaveBeenCalledTimes(1));

    // 同一 key の再レンダーでは再取得しない
    rerender(<DemoDrawer api={api} refreshKey={null} />);
    expect(api.getStatus).toHaveBeenCalledTimes(1);

    // SSE 着弾＝lastUpdatedAt 変化で /demo/status を再取得
    rerender(<DemoDrawer api={api} refreshKey={1000} />);
    await waitFor(() => expect(api.getStatus).toHaveBeenCalledTimes(2));
    rerender(<DemoDrawer api={api} refreshKey={2000} />);
    await waitFor(() => expect(api.getStatus).toHaveBeenCalledTimes(3));
  });

  it("実検知シナリオ注入で検知待ちバナーを出し、INFRASTRUCTURE 着弾で畳む", async () => {
    const api = fakeApi();
    const { rerender } = render(
      <DemoDrawer api={api} refreshKey={1000} lastIncomingAlert={null} />,
    );
    await waitFor(() =>
      expect(
        screen.getByText("インフラ障害（実 Cloud Monitoring）"),
      ).toBeInTheDocument(),
    );

    // 実 Cloud Monitoring 行を開いて注入する。
    await userEvent.click(
      screen.getByRole("button", { name: /インフラ障害（実 Cloud Monitoring）/ }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "インフラ障害（実 Cloud Monitoring） を実行",
      }),
    );

    // クラウド実検知は awaitDetection を渡す → 待機ナレーションが出る。
    await waitFor(() =>
      expect(screen.getByText("実パイプラインが検知中…")).toBeInTheDocument(),
    );
    expect(api.triggerScenario).toHaveBeenCalledWith("3");

    // 別 category の受信（例 remediation でなく APPLICATION アラート）では畳まない。
    rerender(
      <DemoDrawer
        api={api}
        refreshKey={2000}
        lastIncomingAlert={{ category: "APPLICATION" }}
      />,
    );
    expect(screen.getByText("実パイプラインが検知中…")).toBeInTheDocument();

    // 当の INFRASTRUCTURE アラート着弾 → バナーは消える。
    rerender(
      <DemoDrawer
        api={api}
        refreshKey={3000}
        lastIncomingAlert={{ category: "INFRASTRUCTURE" }}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByText("実パイプラインが検知中…")).not.toBeInTheDocument(),
    );
  });

  it("検知待ちバナーは手動 dismiss で閉じられる", async () => {
    const api = fakeApi();
    render(<DemoDrawer api={api} refreshKey={1000} />);
    await waitFor(() =>
      expect(
        screen.getByText("インフラ障害（実 Cloud Monitoring）"),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /インフラ障害（実 Cloud Monitoring）/ }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "インフラ障害（実 Cloud Monitoring） を実行",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("実パイプラインが検知中…")).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: "待機表示を閉じる" }));
    expect(screen.queryByText("実パイプラインが検知中…")).not.toBeInTheDocument();
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
