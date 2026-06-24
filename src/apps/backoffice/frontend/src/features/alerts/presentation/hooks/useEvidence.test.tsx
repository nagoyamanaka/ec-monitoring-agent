import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEvidence } from "./useEvidence";
import type { EvidenceApi } from "../../infrastructure/evidenceApi";
import type {
  EvidenceView,
  InvestigationStatus,
} from "../../domain/EvidenceView";

const EVIDENCE: EvidenceView = {
  appLogs: [
    {
      timestamp: "2026-01-01T00:00:00.000Z",
      severity: "ERROR",
      message: "pool exhausted",
      resource: "ec-backend",
    },
  ],
  terraformDiff: null,
  recentCommits: [],
  collectedAt: "2026-01-01T00:00:01.000Z",
};

function fakeApi(
  statuses: InvestigationStatus[],
  evidence: EvidenceView = EVIDENCE,
): EvidenceApi {
  let i = 0;
  return {
    getInvestigationStatus: vi.fn(async (alertId: string) => ({
      alertId,
      status: statuses[Math.min(i++, statuses.length - 1)],
    })),
    getEvidence: vi.fn(async () => evidence),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useEvidence", () => {
  it("done なら即証拠を fetch する（既知アラート）", async () => {
    const api = fakeApi(["done"]);
    const { result } = renderHook(() => useEvidence(api, "a-1", 10));

    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(result.current.evidence).toEqual(EVIDENCE);
    expect(api.getEvidence).toHaveBeenCalledTimes(1);
  });

  it("done になるまで status をポーリングしてから証拠を取得する", async () => {
    const api = fakeApi(["analyzing", "analyzing", "done"]);
    const { result } = renderHook(() => useEvidence(api, "a-1", 5));

    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(result.current.evidence).toEqual(EVIDENCE);
    // done に至るまで 3 回ポーリング（analyzing×2 → done）し、証拠取得は 1 回だけ
    expect(api.getInvestigationStatus).toHaveBeenCalledTimes(3);
    expect(api.getEvidence).toHaveBeenCalledTimes(1);
  });

  it("status 取得失敗で error 段階になる", async () => {
    const api: EvidenceApi = {
      getInvestigationStatus: vi.fn().mockRejectedValue(new Error("boom")),
      getEvidence: vi.fn(),
    };
    const { result } = renderHook(() => useEvidence(api, "a-1", 5));

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error?.message).toBe("boom");
    expect(api.getEvidence).not.toHaveBeenCalled();
  });

  it("alertId が null なら何も取得しない", () => {
    const api = fakeApi(["done"]);
    renderHook(() => useEvidence(api, null, 5));
    expect(api.getInvestigationStatus).not.toHaveBeenCalled();
  });
});
