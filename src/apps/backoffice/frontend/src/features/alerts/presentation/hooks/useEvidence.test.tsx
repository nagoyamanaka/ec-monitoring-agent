import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEvidence } from "./useEvidence";
import type { EvidenceApi } from "../../infrastructure/evidenceApi";
import type { EvidenceView } from "../../domain/EvidenceView";
import { makeAlert } from "../../test-support/alertFixture";

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

function fakeApi(evidence: EvidenceView = EVIDENCE): EvidenceApi {
  return { getEvidence: vi.fn(async () => evidence) };
}

describe("useEvidence", () => {
  it("done（OPEN）の alert なら即証拠を fetch する", async () => {
    const api = fakeApi();
    const alert = makeAlert({ id: "a-1", status: "OPEN" });
    const { result } = renderHook(() => useEvidence(api, alert));

    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(result.current.evidence).toEqual(EVIDENCE);
    expect(api.getEvidence).toHaveBeenCalledTimes(1);
  });

  it("ANALYZING の間は fetch せず analyzing、done へ遷移したら fetch する", async () => {
    const api = fakeApi();
    const analyzing = makeAlert({ id: "a-1", status: "ANALYZING" });
    const { result, rerender } = renderHook(
      ({ alert }) => useEvidence(api, alert),
      { initialProps: { alert: analyzing } },
    );

    expect(result.current.phase).toBe("analyzing");
    expect(api.getEvidence).not.toHaveBeenCalled();

    // SSE で OPEN へ更新された alert を渡す（ドロワー＝alerts.find が新オブジェクトを渡す）
    rerender({ alert: makeAlert({ id: "a-1", status: "OPEN" }) });
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(api.getEvidence).toHaveBeenCalledTimes(1);
  });

  it("done alert の再レンダー（feedback 更新等）では再 fetch しない", async () => {
    const api = fakeApi();
    const { rerender } = renderHook(({ alert }) => useEvidence(api, alert), {
      initialProps: { alert: makeAlert({ id: "a-1", status: "OPEN" }) },
    });
    await waitFor(() => expect(api.getEvidence).toHaveBeenCalledTimes(1));

    rerender({ alert: makeAlert({ id: "a-1", status: "OPEN" }) });
    await new Promise((r) => setTimeout(r, 10));
    expect(api.getEvidence).toHaveBeenCalledTimes(1);
  });

  it("取得失敗で error 段階になる", async () => {
    const api: EvidenceApi = {
      getEvidence: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const { result } = renderHook(() =>
      useEvidence(api, makeAlert({ id: "a-1", status: "OPEN" })),
    );

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error?.message).toBe("boom");
  });

  it("alert が null なら何もしない", () => {
    const api = fakeApi();
    renderHook(() => useEvidence(api, null));
    expect(api.getEvidence).not.toHaveBeenCalled();
  });
});
