import { describe, expect, it } from "vitest";
import { FORECAST_SYSTEM_INSTRUCTION } from "../infrastructure/GeminiForecastAdapter.js";
import { FORECAST_CLASS_DEFINITIONS } from "./forecastClass.js";
import { computeForecasterVersion, computeSignalFingerprint } from "./forecastFingerprint.js";
import { ForecastSignal, ForecastSignalKind } from "./ForecastSignal.js";

const change: ForecastSignal = {
  id: "chg-1",
  kind: ForecastSignalKind.FUTURE_CHANGE,
  subject: "db_connection_pool",
  when: "Fri merge予定",
  desc: "max_connections 100→40 に縮小",
  source: "github.pr#83",
  url: "https://github.com/o/r/pull/83",
};
const schedule: ForecastSignal = {
  id: "sch-1",
  kind: ForecastSignalKind.SCHEDULE,
  subject: "checkout",
  when: "Sat 20:00-23:00",
  desc: "週末セール",
  source: "schedule.seed",
};

describe("computeSignalFingerprint", () => {
  it("同一入力なら一致する", () => {
    expect(computeSignalFingerprint([change, schedule])).toBe(
      computeSignalFingerprint([{ ...change }, { ...schedule }]),
    );
  });

  it("入力を1バイト変えると一致しない", () => {
    const base = computeSignalFingerprint([change, schedule]);
    expect(computeSignalFingerprint([{ ...change, desc: "max_connections 100→41 に縮小" }, schedule])).not.toBe(base);
    expect(computeSignalFingerprint([change, { ...schedule, when: "Sat 20:00-23:01" }])).not.toBe(base);
    expect(computeSignalFingerprint([{ ...change, url: undefined }, schedule])).not.toBe(base);
  });

  it("集合として扱う: 順序と重複には依存しない", () => {
    const base = computeSignalFingerprint([change, schedule]);
    expect(computeSignalFingerprint([schedule, change])).toBe(base);
    expect(computeSignalFingerprint([change, schedule, change])).toBe(base);
  });

  it("収集順の連番 id は指紋に入れない（同じシグナルが回ごとに別 id でも同じ指紋）", () => {
    expect(computeSignalFingerprint([{ ...change, id: "chg-7" }])).toBe(
      computeSignalFingerprint([change]),
    );
  });
});

describe("computeForecasterVersion", () => {
  const base = {
    model: "gemini-2.5-pro",
    promptTemplate: FORECAST_SYSTEM_INSTRUCTION,
    thresholds: {},
    classDefinitions: FORECAST_CLASS_DEFINITIONS,
    pipelineRules: ["citations: drop risk with 0 valid citations"],
  };

  it("同じ入力なら同じ版（起動をまたいで決定論的）", () => {
    expect(computeForecasterVersion(base)).toBe(computeForecasterVersion({ ...base }));
  });

  it("プロンプトを1文字変えると版が変わる", () => {
    expect(
      computeForecasterVersion({ ...base, promptTemplate: `${FORECAST_SYSTEM_INSTRUCTION}。` }),
    ).not.toBe(computeForecasterVersion(base));
  });

  it("モデル名・閾値・クラス定義・コード上の規則のどれを変えても版が変わる", () => {
    const version = computeForecasterVersion(base);
    expect(computeForecasterVersion({ ...base, model: "gemini-2.5-flash" })).not.toBe(version);
    expect(computeForecasterVersion({ ...base, thresholds: { minConfidence: 0.5 } })).not.toBe(version);
    expect(
      computeForecasterVersion({ ...base, classDefinitions: FORECAST_CLASS_DEFINITIONS.slice(0, 2) }),
    ).not.toBe(version);
    expect(
      computeForecasterVersion({ ...base, pipelineRules: ["citations: drop risk with < 2 valid citations"] }),
    ).not.toBe(version);
  });
});
