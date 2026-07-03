import { describe, expect, it } from "vitest";
import type {
  ForecastBriefingPrimitives,
  ForecastSignalPrimitives,
  RiskItemPrimitives,
} from "@monitoring/Forecast/domain/contracts/ForecastContract";
import {
  incidentAlertId,
  signalKindLabel,
  toForecastBriefingView,
} from "./ForecastView";

const signal = (
  over: Partial<ForecastSignalPrimitives> = {},
): ForecastSignalPrimitives => ({
  id: "sig-1",
  kind: "FUTURE_CHANGE",
  subject: "db.connection_pool",
  when: "マージ後",
  desc: "pool 100→40 に縮小する未マージ PR",
  source: "github.pr.42",
  ...over,
});

const risk = (over: Partial<RiskItemPrimitives> = {}): RiskItemPrimitives => ({
  window: "土曜 20:00-22:00",
  subject: "db.connection_pool",
  level: "HIGH",
  confidence: 0.8,
  citations: ["sig-1"],
  reasoning: "接続上限縮小と負荷スケジュールが重なる",
  ...over,
});

const briefing = (
  risks: RiskItemPrimitives[],
  signals: ForecastSignalPrimitives[],
): ForecastBriefingPrimitives => ({
  forecast: {
    forecastId: "f-1",
    generatedAt: "2026-07-03T10:00:00.000Z",
    horizon: "今週末",
    risks,
    isFallback: false,
  },
  signals,
});

describe("toForecastBriefingView", () => {
  it("citations を同梱シグナルへ解決し、種別ラベル・URL を付与する", () => {
    const view = toForecastBriefingView(
      briefing(
        [risk()],
        [signal({ url: "https://github.com/x/y/pull/42" })],
      ),
    );
    expect(view.risks[0].citations).toHaveLength(1);
    const c = view.risks[0].citations[0];
    expect(c.kindLabel).toBe("未来の変更");
    expect(c.url).toBe("https://github.com/x/y/pull/42");
    expect(c.alertId).toBeUndefined();
  });

  it("MEMORY 引用は source の incident.<id> からアラート id を解決する", () => {
    const view = toForecastBriefingView(
      briefing(
        [risk({ citations: ["sig-m"] })],
        [
          signal({
            id: "sig-m",
            kind: "MEMORY",
            source: "incident.alert-123",
          }),
        ],
      ),
    );
    const c = view.risks[0].citations[0];
    expect(c.kindLabel).toBe("過去の同型事例");
    expect(c.alertId).toBe("alert-123");
  });

  it("解決できない引用 id は表示から落とす（防御）", () => {
    const view = toForecastBriefingView(
      briefing([risk({ citations: ["sig-1", "ghost"] })], [signal()]),
    );
    expect(view.risks[0].citations.map((c) => c.id)).toEqual(["sig-1"]);
  });

  it("risks を level 降順→confidence 降順に並べ、highRiskCount を数える", () => {
    const view = toForecastBriefingView(
      briefing(
        [
          risk({ level: "LOW", confidence: 0.9 }),
          risk({ level: "HIGH", confidence: 0.5 }),
          risk({ level: "HIGH", confidence: 0.7 }),
        ],
        [signal()],
      ),
    );
    expect(view.risks.map((r) => [r.level, r.confidence])).toEqual([
      ["HIGH", 0.7],
      ["HIGH", 0.5],
      ["LOW", 0.9],
    ]);
    expect(view.highRiskCount).toBe(2);
  });

  it("未知 level は LOW へ丸め、confidence はクランプする", () => {
    const view = toForecastBriefingView(
      briefing(
        [
          risk({
            level: "CRITICAL" as RiskItemPrimitives["level"],
            confidence: 1.5,
          }),
        ],
        [signal()],
      ),
    );
    expect(view.risks[0].level).toBe("LOW");
    expect(view.risks[0].confidence).toBe(1);
  });

  it("メタ情報（horizon/isFallback/signalCount）を写す", () => {
    const view = toForecastBriefingView(
      briefing([], [signal(), signal({ id: "sig-2" })]),
    );
    expect(view.horizon).toBe("今週末");
    expect(view.isFallback).toBe(false);
    expect(view.signalCount).toBe(2);
    expect(view.risks).toEqual([]);
  });
});

describe("signalKindLabel / incidentAlertId", () => {
  it("未知の kind は生値のまま返す（degrade）", () => {
    expect(signalKindLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });

  it("incident. プレフィックスが無い source は undefined", () => {
    expect(incidentAlertId({ source: "github.pr.42" })).toBeUndefined();
  });
});
