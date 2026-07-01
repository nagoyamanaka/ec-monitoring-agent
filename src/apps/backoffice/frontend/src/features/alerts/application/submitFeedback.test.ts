import { describe, expect, it, vi } from "vitest";
import type { AlertsApi } from "../infrastructure/alertsApi";
import { submitFeedback, toFeedbackInput } from "./submitFeedback";

describe("toFeedbackInput", () => {
  it("approve は isCorrect: true へ正規化する", () => {
    expect(toFeedbackInput("approve")).toEqual({ isCorrect: true });
  });

  it("reject は isCorrect: false へ正規化する", () => {
    expect(toFeedbackInput("reject")).toEqual({ isCorrect: false });
  });

  it("operatorNote は trim して付与する", () => {
    expect(toFeedbackInput("reject", "  誤検知  ")).toEqual({
      isCorrect: false,
      operatorNote: "誤検知",
    });
  });

  it("空白のみ／未指定の note はキーごと省く", () => {
    expect(toFeedbackInput("approve", "   ")).toEqual({ isCorrect: true });
    expect(toFeedbackInput("approve")).not.toHaveProperty("operatorNote");
  });
});

describe("submitFeedback", () => {
  it("正規化した入力で api.submitFeedback を呼ぶ", async () => {
    const api = {
      getAlerts: vi.fn(),
      getAlert: vi.fn(),
      submitFeedback: vi.fn().mockResolvedValue(undefined),
      reinvestigate: vi.fn().mockResolvedValue(undefined),
      requestReport: vi.fn().mockResolvedValue(undefined),
      promote: vi.fn().mockResolvedValue(undefined),
    } satisfies AlertsApi;
    const signal = new AbortController().signal;

    await submitFeedback(
      api,
      { alertId: "a/1", decision: "reject", operatorNote: " note " },
      signal,
    );

    expect(api.submitFeedback).toHaveBeenCalledWith(
      "a/1",
      { isCorrect: false, operatorNote: "note" },
      signal,
    );
  });
});
