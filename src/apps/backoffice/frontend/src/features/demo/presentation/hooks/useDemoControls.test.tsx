import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDemoControls } from "./useDemoControls";
import type { DemoApi, DemoStatus } from "../../infrastructure/demoApi";
import { HttpError } from "@shared/api/HttpClient";

function status(overrides: Partial<DemoStatus> = {}): DemoStatus {
  return {
    demoEnabled: true,
    totalAlerts: 2,
    promotedPatternCount: 0,
    patternCount: 4,
    ...overrides,
  };
}

function fakeApi(overrides: Partial<DemoApi> = {}): DemoApi {
  return {
    getStatus: vi.fn().mockResolvedValue(status()),
    triggerScenario: vi
      .fn()
      .mockResolvedValue({ scenarioId: "1", label: "決済タイムアウト", orderId: "o-1" }),
    setPaymentMode: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue({ alertsSeeded: 2, patternsSeeded: 4 }),
    ...overrides,
  };
}

describe("useDemoControls", () => {
  it("初回に status を取得し available=true", async () => {
    const api = fakeApi();
    const { result } = renderHook(() => useDemoControls(api));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(true);
    expect(result.current.status?.totalAlerts).toBe(2);
  });

  it("status が 404 なら available=false（DEMO 無効）", async () => {
    const api = fakeApi({
      getStatus: vi.fn().mockRejectedValue(new HttpError(404, "Not Found", null)),
    });
    const { result } = renderHook(() => useDemoControls(api));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("シナリオ注入後に status を再取得する", async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(status({ totalAlerts: 2 }))
      .mockResolvedValueOnce(status({ totalAlerts: 3 }));
    const api = fakeApi({ getStatus });
    const { result } = renderHook(() => useDemoControls(api));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.triggerScenario("1");
    });

    expect(api.triggerScenario).toHaveBeenCalledWith("1");
    await waitFor(() => expect(result.current.status?.totalAlerts).toBe(3));
  });

  it("決済モード切替で paymentMode を更新する", async () => {
    const api = fakeApi();
    const { result } = renderHook(() => useDemoControls(api));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setPaymentMode("TIMEOUT");
    });

    expect(api.setPaymentMode).toHaveBeenCalledWith("TIMEOUT");
    expect(result.current.paymentMode).toBe("TIMEOUT");
  });

  it("操作失敗は error に載せる", async () => {
    const api = fakeApi({
      reset: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const { result } = renderHook(() => useDemoControls(api));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.error?.message).toBe("boom");
    expect(result.current.busy).toBeNull();
  });
});
