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

    // 承認でクローズ（RESOLVED）した a は現役一覧から取り除く
    act(() => stream.emit(makeAlert({ id: "a", status: "RESOLVED" })));
    expect(result.current.alerts.map((a) => a.id)).toEqual(["b"]);
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
});
