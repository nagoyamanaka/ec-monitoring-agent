import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAlerts } from "./useAlerts";
import type { AlertsApi } from "../../infrastructure/alertsApi";
import { MockAlertStream } from "../../infrastructure/MockAlertStream";
import { makeAlert } from "../../test-support/alertFixture";

function fakeApi(initial: ReturnType<typeof makeAlert>[]): AlertsApi {
  return {
    getAlerts: vi.fn().mockResolvedValue(initial),
    getAlert: vi.fn(),
    submitFeedback: vi.fn().mockResolvedValue(undefined),
    reinvestigate: vi.fn().mockResolvedValue(undefined),
    requestReport: vi.fn().mockResolvedValue(undefined),
    promote: vi.fn().mockResolvedValue(undefined),
  };
}

describe("useAlerts", () => {
  it("初回取得 → ready 遷移し一覧を返す", async () => {
    const api = fakeApi([makeAlert({ id: "a" })]);
    const { result } = renderHook(() => useAlerts(api, new MockAlertStream()));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.alerts.map((a) => a.id)).toEqual(["a"]);
  });

  it("ストリーム受信を先頭にマージし、同一IDは置換する", async () => {
    const api = fakeApi([makeAlert({ id: "a", status: "OPEN" })]);
    const stream = new MockAlertStream();
    const { result } = renderHook(() => useAlerts(api, stream));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    // 新規 b は先頭へ
    act(() => stream.emit(makeAlert({ id: "b" })));
    expect(result.current.alerts.map((a) => a.id)).toEqual(["b", "a"]);

    // 同一 ID a の更新は位置を保って置換（ANALYZING→OPEN 相当）
    act(() => stream.emit(makeAlert({ id: "a", status: "ANALYZING" })));
    expect(result.current.alerts.map((a) => a.id)).toEqual(["b", "a"]);
    expect(result.current.alerts.find((a) => a.id === "a")?.status).toBe(
      "ANALYZING",
    );
  });

  it("取得失敗時は error 遷移する", async () => {
    const api: AlertsApi = {
      getAlerts: vi.fn().mockRejectedValue(new Error("network down")),
      getAlert: vi.fn(),
      submitFeedback: vi.fn(),
      reinvestigate: vi.fn(),
      requestReport: vi.fn(),
      promote: vi.fn(),
    };
    const { result } = renderHook(() => useAlerts(api, new MockAlertStream()));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe("network down");
  });

  it("取得失敗後は指数バックオフで自動リトライし、成功したら ready になる", async () => {
    vi.useFakeTimers();
    try {
      const getAlerts = vi
        .fn()
        .mockRejectedValueOnce(new Error("HTTP 500"))
        .mockRejectedValueOnce(new Error("HTTP 500"))
        .mockResolvedValue([makeAlert({ id: "a" })]);
      const api: AlertsApi = {
        getAlerts,
        getAlert: vi.fn(),
        submitFeedback: vi.fn(),
        reinvestigate: vi.fn(),
        requestReport: vi.fn(),
        promote: vi.fn(),
      };
      const { result } = renderHook(() =>
        useAlerts(api, new MockAlertStream()),
      );

      // 初回失敗 → error だが retrying=true（1s 後に再試行が控えている）
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.status).toBe("error");
      expect(result.current.retrying).toBe(true);

      // 1s 後: 2回目も失敗 → まだ retrying（次は 2s 後）
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(result.current.retrying).toBe(true);

      // さらに 2s 後: 3回目で成功 → ready
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(result.current.status).toBe("ready");
      expect(result.current.retrying).toBe(false);
      expect(result.current.alerts.map((a) => a.id)).toEqual(["a"]);
      expect(getAlerts).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("リトライを使い切ったら retrying=false のまま error に留まる", async () => {
    vi.useFakeTimers();
    try {
      const getAlerts = vi.fn().mockRejectedValue(new Error("HTTP 500"));
      const api: AlertsApi = {
        getAlerts,
        getAlert: vi.fn(),
        submitFeedback: vi.fn(),
        reinvestigate: vi.fn(),
        requestReport: vi.fn(),
        promote: vi.fn(),
      };
      const { result } = renderHook(() =>
        useAlerts(api, new MockAlertStream()),
      );

      // 初回 + リトライ3回（1s/2s/4s）を全部消化する
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });

      expect(getAlerts).toHaveBeenCalledTimes(4);
      expect(result.current.status).toBe("error");
      expect(result.current.retrying).toBe(false);

      // 以降は時間が経っても再試行しない
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(getAlerts).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
