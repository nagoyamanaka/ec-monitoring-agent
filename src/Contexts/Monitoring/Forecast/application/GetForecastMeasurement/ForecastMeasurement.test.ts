import { describe, expect, it } from "vitest";
import { ForecastBriefing } from "../../domain/ForecastBriefing.js";
import { ForecastSignal, ForecastSignalKind } from "../../domain/ForecastSignal.js";
import { CitationVerificationStats, RiskItem } from "../../domain/RiskForecast.js";
import { buildForecastMeasurement } from "./ForecastMeasurement.js";

const change = (id: string): ForecastSignal => ({
  id,
  kind: ForecastSignalKind.FUTURE_CHANGE,
  subject: "db.connection_pool",
  when: "未マージ",
  desc: "pool 縮小",
  source: `github.${id}`,
});

const memory = (id: string): ForecastSignal => ({
  id,
  kind: ForecastSignalKind.MEMORY,
  subject: "db.connection_pool",
  when: "過去の解決済みインシデント",
  desc: "枯渇 → 上限拡大で解消",
  source: "incident.alert-1",
});

const schedule = (id: string): ForecastSignal => ({
  id,
  kind: ForecastSignalKind.SCHEDULE,
  subject: "checkout",
  when: "土 20:00-23:00",
  desc: "週末セール",
  source: "schedule.seed",
});

const risk = (
  level: RiskItem["level"],
  citations: string[],
  subject = "db.connection_pool",
): RiskItem => ({
  window: "土 20:00",
  subject,
  level,
  confidence: 0.8,
  citations,
  reasoning: "根拠",
});

const briefing = (params: {
  risks?: RiskItem[];
  signals?: ForecastSignal[];
  verification?: CitationVerificationStats;
  isFallback?: boolean;
}): ForecastBriefing => ({
  forecast: {
    forecastId: "f-1",
    generatedAt: new Date("2026-08-04T00:00:00.000Z"),
    horizon: "今週末",
    risks: params.risks ?? [],
    isFallback: params.isFallback ?? false,
    ...(params.verification ? { verification: params.verification } : {}),
  },
  signals: params.signals ?? [],
});

const stats = (
  citationsEmitted: number,
  citationsDropped: number,
  risksEmitted: number,
  risksDropped: number,
): CitationVerificationStats => ({
  citationsEmitted,
  citationsDropped,
  risksEmitted,
  risksDropped,
});

describe("buildForecastMeasurement", () => {
  it("履歴が空なら全部 0（level は3段とも 0 で残す）", () => {
    const measurement = buildForecastMeasurement([]);

    expect(measurement.forecasts).toBe(0);
    expect(measurement.citationsEmitted).toBe(0);
    expect(measurement.signalsByKind).toEqual([]);
    // 「HIGH が出ていない」と「HIGH の列が無い」を同じ見え方にしない
    expect(measurement.byLevel.map((entry) => entry.level)).toEqual([
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);
    expect(measurement.byLevel.every((entry) => entry.count === 0)).toBe(true);
  });

  it("破棄側のカウンタを予報をまたいで合算する（E6-1）", () => {
    const measurement = buildForecastMeasurement([
      briefing({
        risks: [risk("HIGH", ["chg-1"])],
        signals: [change("chg-1")],
        verification: stats(3, 2, 2, 1),
      }),
      briefing({
        risks: [risk("LOW", ["chg-1"])],
        signals: [change("chg-1")],
        verification: stats(1, 0, 1, 0),
      }),
    ]);

    expect(measurement.forecasts).toBe(2);
    expect(measurement.citationsEmitted).toBe(4);
    expect(measurement.citationsDropped).toBe(2);
    expect(measurement.risksEmitted).toBe(3);
    expect(measurement.risksDropped).toBe(1);
  });

  it("収集シグナルを kind 別に数え、検証後に残ったリスク数と並べる（E6-3）", () => {
    const measurement = buildForecastMeasurement([
      briefing({
        risks: [risk("HIGH", ["chg-1", "inc-1"]), risk("LOW", ["sch-1"], "checkout")],
        signals: [change("chg-1"), schedule("sch-1"), memory("inc-1")],
        verification: stats(3, 0, 2, 0),
      }),
    ]);

    expect(measurement.signalsCollected).toBe(3);
    expect(measurement.signalsByKind).toEqual([
      { kind: "FUTURE_CHANGE", count: 1 },
      { kind: "SCHEDULE", count: 1 },
      { kind: "MEMORY", count: 1 },
    ]);
    expect(measurement.risksSurvived).toBe(2);
  });

  it("level 分布を MEMORY 引用の有無で割る（A5-b「前例が無くても出る。ただし弱く出る」の実測）", () => {
    const measurement = buildForecastMeasurement([
      briefing({
        risks: [
          risk("HIGH", ["chg-1", "inc-1"]), // 過去障害あり → 強く出た
          risk("LOW", ["chg-1"]), // 過去障害なし → 弱く出た
          risk("MEDIUM", ["sch-1"], "checkout"), // 過去障害なし
        ],
        signals: [change("chg-1"), schedule("sch-1"), memory("inc-1")],
        verification: stats(4, 0, 3, 0),
      }),
    ]);

    expect(measurement.byLevel).toEqual([
      { level: "HIGH", count: 1, withMemoryCitation: 1 },
      { level: "MEDIUM", count: 1, withMemoryCitation: 0 },
      { level: "LOW", count: 1, withMemoryCitation: 0 },
    ]);
  });

  it("fallback / シグナル0件 / 検証カウンタ未保存 を別々に除外して件数で残す", () => {
    const measurement = buildForecastMeasurement([
      briefing({ isFallback: true, signals: [change("chg-1")] }),
      briefing({}), // シグナル0件＝ LLM 非呼び出しの空予報
      briefing({ risks: [risk("HIGH", ["chg-1"])], signals: [change("chg-1")] }), // 旧データ
      briefing({
        risks: [risk("HIGH", ["chg-1"])],
        signals: [change("chg-1")],
        verification: stats(1, 0, 1, 0),
      }),
    ]);

    expect(measurement.forecasts).toBe(1);
    expect(measurement.excludedFallback).toBe(1);
    expect(measurement.excludedNoSignals).toBe(1);
    expect(measurement.excludedUnmeasured).toBe(1);
    // 除外した予報のリスク・シグナルは一切数字に混ざらない
    expect(measurement.risksSurvived).toBe(1);
    expect(measurement.signalsCollected).toBe(1);
  });
});
