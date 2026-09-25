import { describe, expect, it } from "vitest";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";
import { ForecastClass } from "./forecastClass.js";
import { DEFAULT_WINDOW_LENGTH_HOURS, ForecastWindowPolicy } from "./ForecastWindowPolicy.js";

describe("ForecastWindowPolicy", () => {
  it("上書きが無ければ全クラス既定 72h", () => {
    const policy = ForecastWindowPolicy.fromOverrides({});
    expect(DEFAULT_WINDOW_LENGTH_HOURS).toBe(72);
    for (const cls of Object.values(ForecastClass)) {
      expect(policy.windowLengthHours(cls)).toBe(72);
    }
  });

  it("config のクラス別上書きが効く（load_risk だけ 24h）", () => {
    const policy = ForecastWindowPolicy.fromOverrides({ load_risk: 24 });
    expect(policy.windowLengthHours(ForecastClass.LOAD_RISK)).toBe(24);
    expect(policy.windowLengthHours(ForecastClass.CHANGE_RISK)).toBe(72);
    expect(policy.windowLengthHours(ForecastClass.RECURRENCE_RISK)).toBe(72);
  });

  it("窓長が変われば windowPolicyVersion も変わり、同じ窓長なら一致する", () => {
    const base = ForecastWindowPolicy.fromOverrides({});
    expect(ForecastWindowPolicy.fromOverrides({ load_risk: 24 }).version).not.toBe(base.version);
    expect(ForecastWindowPolicy.fromOverrides({ load_risk: 72 }).version).toBe(base.version);
  });

  it("未知のクラス名・正の整数でない窓長は起動時に落とす", () => {
    expect(() => ForecastWindowPolicy.fromOverrides({ unknown_risk: 24 })).toThrow(InvalidArgumentError);
    expect(() => ForecastWindowPolicy.fromOverrides({ load_risk: 0 })).toThrow(InvalidArgumentError);
    expect(() => ForecastWindowPolicy.fromOverrides({ load_risk: 1.5 })).toThrow(InvalidArgumentError);
  });
});
