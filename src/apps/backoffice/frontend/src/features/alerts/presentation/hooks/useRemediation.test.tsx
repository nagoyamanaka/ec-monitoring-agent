import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRemediation } from "./useRemediation";
import type { RemediationApi } from "../../infrastructure/remediationApi";
import {
  toRemediationView,
  type RemediationResponseWire,
} from "../../domain/RemediationView";

function view(overrides: Partial<RemediationResponseWire> = {}) {
  return toRemediationView({
    alertId: "a-1",
    status: "none",
    pullRequestUrl: null,
    vulnerabilityCount: 0,
    reason: null,
    createdAt: null,
    ...overrides,
  });
}

describe("useRemediation", () => {
  it("初回取得 → ready で状態を返す", async () => {
    const api: RemediationApi = {
      getRemediation: vi.fn().mockResolvedValue(view({ status: "none" })),
      draftRemediation: vi.fn(),
    };
    const { result } = renderHook(() => useRemediation(api, "a-1"));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.remediation?.status).toBe("none");
  });

  it("draft() で起票 → 202 後に再取得して状態を反映する", async () => {
    const getRemediation = vi
      .fn()
      .mockResolvedValueOnce(view({ status: "none" }))
      .mockResolvedValueOnce(
        view({ status: "drafted", pullRequestUrl: "https://x/pr/1" }),
      );
    const api: RemediationApi = {
      getRemediation,
      draftRemediation: vi.fn().mockResolvedValue(undefined),
    };
    const { result } = renderHook(() => useRemediation(api, "a-1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.draft();
    });

    expect(api.draftRemediation).toHaveBeenCalledWith("a-1", undefined);
    expect(result.current.remediation?.status).toBe("drafted");
    expect(result.current.remediation?.pullRequestUrl).toBe("https://x/pr/1");
  });

  it("dispatched の間はポーリングし、drafted に確定したら止まる", async () => {
    const getRemediation = vi
      .fn()
      .mockResolvedValueOnce(view({ status: "dispatched" }))
      .mockResolvedValueOnce(view({ status: "dispatched" }))
      .mockResolvedValue(
        view({ status: "drafted", pullRequestUrl: "https://x/pr/1" }),
      );
    const api: RemediationApi = {
      getRemediation,
      draftRemediation: vi.fn(),
    };
    const { result } = renderHook(() => useRemediation(api, "a-1", 5));

    await waitFor(() =>
      expect(result.current.remediation?.status).toBe("drafted"),
    );
    // ポーリングが止まっていることを確認（呼び出し回数が増え続けない）
    const calls = getRemediation.mock.calls.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(getRemediation.mock.calls.length).toBe(calls);
  });

  it("取得失敗で error 遷移する", async () => {
    const api: RemediationApi = {
      getRemediation: vi.fn().mockRejectedValue(new Error("down")),
      draftRemediation: vi.fn(),
    };
    const { result } = renderHook(() => useRemediation(api, "a-1"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe("down");
  });
});
