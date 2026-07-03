import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { HttpError } from "@shared/api/HttpClient";
import type { AlertView } from "../../domain/AlertView";
import type { AlertsApi } from "../../infrastructure/alertsApi";
import type { AlertsStatus } from "./useAlerts";
import { useAlertDetail } from "./useAlertDetail";

/**
 * 詳細ページの二源解決（現役＝共有一覧 state / アーカイブ＝GET /alerts/:id）。
 * 呼び出し側から見た単一インターフェース {alert,status,refresh} の分岐を fake 注入で固定する。
 */

const ACTIVE = { id: "active-1", status: "OPEN" } as unknown as AlertView;
const ARCHIVED = { id: "5eed-0002", status: "RESOLVED" } as unknown as AlertView;

function fakeApi(getAlert: AlertsApi["getAlert"]): AlertsApi {
  return { getAlert } as unknown as AlertsApi;
}

function params(over: {
  id?: string;
  alerts?: AlertView[];
  listStatus?: AlertsStatus;
  refreshAlert?: (id: string) => Promise<void>;
  api?: AlertsApi;
}) {
  return {
    id: over.id,
    alerts: over.alerts ?? [],
    listStatus: over.listStatus ?? ("ready" as AlertsStatus),
    refreshAlert: over.refreshAlert ?? vi.fn().mockResolvedValue(undefined),
    api: over.api ?? fakeApi(vi.fn()),
  };
}

describe("useAlertDetail", () => {
  it("現役（一覧に居る）は共有 state から即 ready・アーカイブ取得はしない", () => {
    const getAlert = vi.fn();
    const p = params({ id: "active-1", alerts: [ACTIVE], api: fakeApi(getAlert) });
    const { result } = renderHook(() => useAlertDetail(p));

    expect(result.current.status).toBe("ready");
    expect(result.current.alert).toBe(ACTIVE);
    expect(getAlert).not.toHaveBeenCalled();
  });

  it("一覧未確定（loading/error）の間は源を確定せず listStatus を伝播する", () => {
    const getAlert = vi.fn();
    const loading = params({
      id: "5eed-0002",
      listStatus: "loading",
      api: fakeApi(getAlert),
    });
    const { result } = renderHook(() => useAlertDetail(loading));

    expect(result.current.status).toBe("loading");
    // 一覧が確定するまではアーカイブ取得も走らせない（無駄打ち防止）。
    expect(getAlert).not.toHaveBeenCalled();
  });

  it("一覧 ready＋一覧に無い id は GET /alerts/:id で解決して ready になる", async () => {
    const getAlert = vi.fn().mockResolvedValue(ARCHIVED);
    const p = params({ id: "5eed-0002", alerts: [], api: fakeApi(getAlert) });
    const { result } = renderHook(() => useAlertDetail(p));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.alert).toBe(ARCHIVED);
    expect(getAlert).toHaveBeenCalledWith("5eed-0002", expect.anything());
  });

  it("404 は notfound、その他の失敗は error に分ける", async () => {
    const notFound = params({
      id: "ghost",
      api: fakeApi(vi.fn().mockRejectedValue(new HttpError(404, "Not Found", null))),
    });
    const { result: r404 } = renderHook(() => useAlertDetail(notFound));
    await waitFor(() => expect(r404.current.status).toBe("notfound"));

    const boom = params({
      id: "5eed-0002",
      api: fakeApi(vi.fn().mockRejectedValue(new Error("network down"))),
    });
    const { result: rErr } = renderHook(() => useAlertDetail(boom));
    await waitFor(() => expect(rErr.current.status).toBe("error"));
  });

  it("refresh: 現役は refreshAlert（共有 state へ merge）、アーカイブは単品再取得", async () => {
    // 現役
    const refreshAlert = vi.fn().mockResolvedValue(undefined);
    const activeGet = vi.fn();
    const active = params({
      id: "active-1",
      alerts: [ACTIVE],
      refreshAlert,
      api: fakeApi(activeGet),
    });
    const { result: rActive } = renderHook(() => useAlertDetail(active));
    await act(async () => {
      await rActive.current.refresh("active-1");
    });
    expect(refreshAlert).toHaveBeenCalledWith("active-1");
    expect(activeGet).not.toHaveBeenCalled(); // 共有 state 経由＝単品 GET はしない

    // アーカイブ（一覧に居ない）
    const updated = { ...ARCHIVED, occurrenceCount: 2 } as unknown as AlertView;
    const archiveGet = vi
      .fn()
      .mockResolvedValueOnce(ARCHIVED)
      .mockResolvedValueOnce(updated);
    const refreshAlert2 = vi.fn();
    const archive = params({
      id: "5eed-0002",
      alerts: [],
      refreshAlert: refreshAlert2,
      api: fakeApi(archiveGet),
    });
    const { result: rArchive } = renderHook(() => useAlertDetail(archive));
    await waitFor(() => expect(rArchive.current.status).toBe("ready"));
    await act(async () => {
      await rArchive.current.refresh("5eed-0002");
    });
    expect(rArchive.current.alert).toBe(updated);
    expect(refreshAlert2).not.toHaveBeenCalled(); // 一覧に居ない＝共有 merge しない
    expect(archiveGet).toHaveBeenCalledTimes(2);
  });
});
