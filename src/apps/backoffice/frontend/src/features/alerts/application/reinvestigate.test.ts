import { describe, expect, it, vi } from "vitest";
import type { AlertsApi } from "../infrastructure/alertsApi";
import { reinvestigate } from "./reinvestigate";

describe("reinvestigate", () => {
  it("trim した note で api.reinvestigate を呼ぶ", async () => {
    const api = {
      getAlerts: vi.fn(),
      getAlert: vi.fn(),
      submitFeedback: vi.fn(),
      reinvestigate: vi.fn().mockResolvedValue(undefined),
    } satisfies AlertsApi;
    const signal = new AbortController().signal;

    await reinvestigate(
      api,
      { alertId: "a/1", operatorNote: "  閾値を見直して  " },
      signal,
    );

    expect(api.reinvestigate).toHaveBeenCalledWith(
      "a/1",
      { operatorNote: "閾値を見直して" },
      signal,
    );
  });
});
