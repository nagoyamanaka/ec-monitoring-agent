import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { HttpError } from "@shared/api/HttpClient";
import type { AlertView } from "../../domain/AlertView";
import type { AlertsApi } from "../../infrastructure/alertsApi";
import { useArchiveAlert } from "./useArchiveAlert";

/**
 * 解決済みアーカイブ Alert のフォールバック取得（詳細ページのディープリンク解決）。
 * 一覧が RESOLVED を返さない前提で、GET /alerts/:id 直引きの分岐（成功/404/失敗/無効）を固定する。
 */

const ARCHIVED = { id: "5eed-0002", status: "RESOLVED" } as unknown as AlertView;

function fakeApi(getAlert: AlertsApi["getAlert"]): AlertsApi {
  return { getAlert } as unknown as AlertsApi;
}

describe("useArchiveAlert", () => {
  it("enabled=false（一覧に居る/一覧未確定）の間は idle で API を呼ばない", () => {
    const getAlert = vi.fn();
    const api = fakeApi(getAlert);
    const { result } = renderHook(() =>
      useArchiveAlert(api, "5eed-0002", false),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.alert).toBeNull();
    expect(getAlert).not.toHaveBeenCalled();
  });

  it("enabled になったら GET /alerts/:id で引いて ready になる", async () => {
    const getAlert = vi.fn().mockResolvedValue(ARCHIVED);
    // api は AlertsDataProvider が保持する安定参照の前提（inline 生成だと effect が毎レンダー再発火する）
    const api = fakeApi(getAlert);
    const { result } = renderHook(() => useArchiveAlert(api, "5eed-0002", true));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.alert).toBe(ARCHIVED);
    expect(getAlert).toHaveBeenCalledWith("5eed-0002", expect.anything());
  });

  it("404 は notfound（存在しない id）、その他の失敗は error に分ける", async () => {
    const notFoundApi = fakeApi(
      vi.fn().mockRejectedValue(new HttpError(404, "Not Found", null)),
    );
    const { result: r404 } = renderHook(() =>
      useArchiveAlert(notFoundApi, "ghost", true),
    );
    await waitFor(() => expect(r404.current.status).toBe("notfound"));

    const boomApi = fakeApi(vi.fn().mockRejectedValue(new Error("network down")));
    const { result: rErr } = renderHook(() =>
      useArchiveAlert(boomApi, "5eed-0002", true),
    );
    await waitFor(() => expect(rErr.current.status).toBe("error"));
  });

  it("refresh() は単品を再取得する（共有一覧へは merge しない設計＝ローカル state 更新のみ）", async () => {
    const updated = { ...ARCHIVED, occurrenceCount: 2 } as unknown as AlertView;
    const getAlert = vi
      .fn()
      .mockResolvedValueOnce(ARCHIVED)
      .mockResolvedValueOnce(updated);
    const api = fakeApi(getAlert);
    const { result } = renderHook(() => useArchiveAlert(api, "5eed-0002", true));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.alert).toBe(updated);
    expect(getAlert).toHaveBeenCalledTimes(2);
  });
});
