import { describe, expect, it } from "vitest";
import { sortAlerts } from "./alertSort";
import { makeAlert } from "../test-support/alertFixture";

describe("sortAlerts（最新時刻順・承認済みは最下部）", () => {
  it("承認済み（feedback.isCorrect）を下、未処理を上にする", () => {
    const approved = makeAlert({
      id: "approved",
      occurredOn: "2026-06-21T02:00:00.000Z", // 新しくても承認済みは下
      feedback: { isCorrect: true },
    });
    const pending = makeAlert({
      id: "pending",
      occurredOn: "2026-06-21T00:00:00.000Z",
      feedback: null,
    });
    const sorted = sortAlerts([approved, pending]);
    expect(sorted.map((a) => a.id)).toEqual(["pending", "approved"]);
  });

  it("却下（isCorrect=false）は未処理と同じく上に残す", () => {
    const rejected = makeAlert({
      id: "rejected",
      occurredOn: "2026-06-21T01:00:00.000Z",
      feedback: { isCorrect: false },
    });
    const approved = makeAlert({
      id: "approved",
      occurredOn: "2026-06-21T02:00:00.000Z",
      feedback: { isCorrect: true },
    });
    const sorted = sortAlerts([approved, rejected]);
    expect(sorted.map((a) => a.id)).toEqual(["rejected", "approved"]);
  });

  it("同じ処理段では発生時刻の降順（新しいほど上）", () => {
    const older = makeAlert({ id: "older", occurredOn: "2026-06-21T00:00:00.000Z" });
    const newer = makeAlert({ id: "newer", occurredOn: "2026-06-21T01:00:00.000Z" });
    const sorted = sortAlerts([older, newer]);
    expect(sorted.map((a) => a.id)).toEqual(["newer", "older"]);
  });

  it("元配列は破壊しない", () => {
    const input = [
      makeAlert({ id: "a", feedback: { isCorrect: true } }),
      makeAlert({ id: "b", feedback: null }),
    ];
    const snapshot = input.map((a) => a.id);
    sortAlerts(input);
    expect(input.map((a) => a.id)).toEqual(snapshot);
  });
});
