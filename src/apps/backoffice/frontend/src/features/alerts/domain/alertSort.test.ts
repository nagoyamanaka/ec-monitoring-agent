import { describe, expect, it } from "vitest";
import { sortForTriage } from "./alertSort";
import { makeAlert, makeReport } from "../test-support/alertFixture";

describe("sortForTriage", () => {
  it("処理済み（承認/却下）を下、未処理を上にする", () => {
    const approved = makeAlert({
      id: "approved",
      report: makeReport({ reviewStatus: "APPROVED" }),
    });
    const pending = makeAlert({
      id: "pending",
      report: makeReport({ reviewStatus: "PENDING_REVIEW" }),
    });
    const sorted = sortForTriage([approved, pending]);
    expect(sorted.map((a) => a.id)).toEqual(["pending", "approved"]);
  });

  it("同じ処理段では重大度の降順", () => {
    const warning = makeAlert({
      id: "warn",
      severity: "WARNING",
      report: makeReport({ reviewStatus: "PENDING_REVIEW" }),
    });
    const critical = makeAlert({
      id: "crit",
      severity: "CRITICAL",
      report: makeReport({ reviewStatus: "PENDING_REVIEW" }),
    });
    const sorted = sortForTriage([warning, critical]);
    expect(sorted.map((a) => a.id)).toEqual(["crit", "warn"]);
  });

  it("重大度も同じなら発生時刻の降順（新しいほど上）", () => {
    const older = makeAlert({
      id: "older",
      occurredOn: "2026-06-21T00:00:00.000Z",
      report: makeReport({ reviewStatus: "PENDING_REVIEW" }),
    });
    const newer = makeAlert({
      id: "newer",
      occurredOn: "2026-06-21T01:00:00.000Z",
      report: makeReport({ reviewStatus: "PENDING_REVIEW" }),
    });
    const sorted = sortForTriage([older, newer]);
    expect(sorted.map((a) => a.id)).toEqual(["newer", "older"]);
  });

  it("元配列は破壊しない", () => {
    const input = [
      makeAlert({ id: "a", report: makeReport({ reviewStatus: "APPROVED" }) }),
      makeAlert({ id: "b", report: makeReport({ reviewStatus: "PENDING_REVIEW" }) }),
    ];
    const snapshot = input.map((a) => a.id);
    sortForTriage(input);
    expect(input.map((a) => a.id)).toEqual(snapshot);
  });
});
