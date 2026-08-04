import { describe, expect, it } from "vitest";
import {
  DECLARED_REMEDIATION_MINUTES,
  effectiveLeadTime,
  formatEffectiveLeadTime,
} from "./remediationLeadTime.js";

const issuedAt = new Date("2026-08-04T09:00:00.000Z");

describe("effectiveLeadTime", () => {
  it("予測発生 − 発行 − 対処所要（宣言値）で引く", () => {
    const lead = effectiveLeadTime({
      issuedAt,
      predictedAt: new Date("2026-08-04T20:00:00.000Z"),
    });

    expect(lead.leadMinutes).toBe(660); // 11時間
    expect(lead.remediationMinutes).toBe(DECLARED_REMEDIATION_MINUTES);
    expect(lead.effectiveMinutes).toBe(630); // 10時間30分
  });

  it("間に合わない予報は負のまま返す（0 に丸めない）", () => {
    // 「これが負なら、その予報クラスは的中しても価値がない」を数字で言えることが目的。
    const lead = effectiveLeadTime({
      issuedAt,
      predictedAt: new Date("2026-08-04T09:10:00.000Z"),
    });

    expect(lead.leadMinutes).toBe(10);
    expect(lead.effectiveMinutes).toBe(-20);
  });

  it("クラス別の値を持つようになったら宣言値を上書きできる", () => {
    const lead = effectiveLeadTime({
      issuedAt,
      predictedAt: new Date("2026-08-04T10:00:00.000Z"),
      remediationMinutes: 15,
    });

    expect(lead.effectiveMinutes).toBe(45);
  });
});

describe("formatEffectiveLeadTime", () => {
  it("宣言値であることを必ず添える（実測と読ませない）", () => {
    const text = formatEffectiveLeadTime(
      effectiveLeadTime({
        issuedAt,
        predictedAt: new Date("2026-08-04T20:00:00.000Z"),
      }),
    );

    expect(text).toBe(
      "予測発生まで 約 11 時間・対処の所要は約 30 分（宣言値）＝ 判断に使える時間は 約 10 時間 30 分",
    );
  });

  it("負なら「間に合わない見込み」と不足分を出す", () => {
    const text = formatEffectiveLeadTime(
      effectiveLeadTime({
        issuedAt,
        predictedAt: new Date("2026-08-04T09:10:00.000Z"),
      }),
    );

    expect(text).toContain("対処が間に合わない見込み");
    expect(text).toContain("約 20 分の不足");
  });
});
