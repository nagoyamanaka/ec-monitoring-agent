import { describe, expect, it } from "vitest";
import { ForecastBriefing } from "./ForecastBriefing.js";
import { issueForecasts, ForecastLedgerStamp } from "./ForecastLedger.js";
import { ForecastSignal, ForecastSignalKind } from "./ForecastSignal.js";
import { ForecastWindowPolicy } from "./ForecastWindowPolicy.js";
import { RiskItem } from "./RiskForecast.js";

const signals: ForecastSignal[] = [
  { id: "chg-1", kind: ForecastSignalKind.FUTURE_CHANGE, subject: "db_connection_pool", when: "Fri", desc: "縮小", source: "github.pr#83" },
  { id: "sch-1", kind: ForecastSignalKind.SCHEDULE, subject: "checkout", when: "Sat 20:00", desc: "セール", source: "schedule.seed" },
  { id: "inc-1", kind: ForecastSignalKind.MEMORY, subject: "valkey", when: "過去", desc: "枯渇", source: "incident.a-1" },
];

const risk = (subject: string, citations: string[], level: RiskItem["level"] = "HIGH"): RiskItem => ({
  window: "Sat 20:00",
  subject,
  level,
  confidence: 0.8,
  citations,
  reasoning: "根拠",
});

const briefing = (risks: RiskItem[]): ForecastBriefing => ({
  forecast: {
    forecastId: "briefing-1",
    generatedAt: new Date("2026-09-24T00:00:00.000Z"),
    horizon: "今週末",
    risks,
    isFallback: false,
  },
  signals,
});

const stamp: ForecastLedgerStamp = {
  protocolVersion: "preregistration-v1",
  forecasterVersion: "fv-1",
  windowPolicy: ForecastWindowPolicy.fromOverrides({ load_risk: 24 }),
};

describe("issueForecasts", () => {
  it("risk 1件につき issued 1行。forecastId は行ごとに別、briefingId は元の予報", () => {
    const rows = issueForecasts(
      briefing([risk("db_connection_pool", ["chg-1", "sch-1"]), risk("checkout", ["sch-1"], "MEDIUM")]),
      stamp,
    );

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.forecastId)).size).toBe(2);
    expect(rows.every((row) => row.briefingId === "briefing-1")).toBe(true);
    expect(rows[0]).toMatchObject({
      eventType: "issued",
      protocolVersion: "preregistration-v1",
      forecasterVersion: "fv-1",
      subjectKey: "db_connection_pool",
      level: "HIGH",
      issuedAt: new Date("2026-09-24T00:00:00.000Z"),
      windowPolicyVersion: stamp.windowPolicy.version,
      evidenceSnapshotId: "",
      assignment: "normal",
      assignmentProb: 1.0,
    });
  });

  it("クラスは引用シグナルの種類から決まり、窓長と windowEndsAt がクラス別になる", () => {
    const [change, load, recurrence] = issueForecasts(
      briefing([
        risk("db_connection_pool", ["chg-1", "sch-1", "inc-1"]),
        risk("checkout", ["sch-1", "inc-1"]),
        risk("valkey", ["inc-1"]),
      ]),
      stamp,
    );

    expect(change).toMatchObject({ class: "change_risk", windowLengthHours: 72 });
    expect(change.windowEndsAt.toISOString()).toBe("2026-09-27T00:00:00.000Z");
    expect(load).toMatchObject({ class: "load_risk", windowLengthHours: 24 });
    expect(load.windowEndsAt.toISOString()).toBe("2026-09-25T00:00:00.000Z");
    expect(recurrence).toMatchObject({ class: "recurrence_risk", windowLengthHours: 72 });
  });

  it("指紋は引用したシグナルだけから作る（同じ引用集合なら同じ指紋）", () => {
    const [a, b, c] = issueForecasts(
      briefing([risk("x", ["chg-1", "sch-1"]), risk("y", ["sch-1", "chg-1"]), risk("z", ["sch-1"])]),
      stamp,
    );
    expect(a.signalFingerprint).toBe(b.signalFingerprint);
    expect(c.signalFingerprint).not.toBe(a.signalFingerprint);
  });

  it("risk が0件（空予報・fallback）なら行も0件", () => {
    expect(issueForecasts(briefing([]), stamp)).toEqual([]);
  });
});
