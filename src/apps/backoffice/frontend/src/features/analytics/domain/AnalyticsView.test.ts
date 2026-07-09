import { describe, expect, it } from "vitest";
import {
  type AnalyticsDto,
  type ApprovedAlertSummaryDto,
  patternLabel,
  selectLifecycleAlert,
  toAnalyticsView,
} from "./AnalyticsView";

const base: AnalyticsDto = {
  totalAlerts: 10,
  knownCount: 6,
  unknownCount: 4,
  withFeedbackCount: 5,
  correctCount: 4,
  incorrectCount: 1,
  accuracy: 0.8,
};

describe("toAnalyticsView", () => {
  it("accuracy を整数％へ・known 比率を算出する", () => {
    const v = toAnalyticsView(base);
    expect(v.accuracyPercent).toBe(80);
    expect(v.knownRatio).toBeCloseTo(0.6);
  });

  it("フィードバック未着（accuracy=null）は percent も null", () => {
    const v = toAnalyticsView({ ...base, accuracy: null });
    expect(v.accuracy).toBeNull();
    expect(v.accuracyPercent).toBeNull();
  });

  it("総数0でも 0除算せず knownRatio=0", () => {
    const v = toAnalyticsView({
      totalAlerts: 0,
      knownCount: 0,
      unknownCount: 0,
      withFeedbackCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: null,
    });
    expect(v.knownRatio).toBe(0);
  });

  it("promotedPatternCount は旧backend互換で未定義なら0", () => {
    expect(toAnalyticsView(base).promotedPatternCount).toBe(0);
    expect(
      toAnalyticsView({ ...base, promotedPatternCount: 3 })
        .promotedPatternCount,
    ).toBe(3);
  });
});

function approved(
  over: Partial<ApprovedAlertSummaryDto> = {},
): ApprovedAlertSummaryDto {
  return {
    id: "a1",
    eventName: "ec.checkout.latency_degraded",
    category: "application",
    severity: "WARNING",
    classificationType: "unknown",
    patternName: "DB_CONNECTION_POOL_EXHAUSTION",
    occurredOn: "2026-06-20T11:20:00.000Z",
    occurrenceCount: 1,
    operatorNote: "プールを一時増強して回避",
    ...over,
  };
}

describe("selectLifecycleAlert", () => {
  it("再発済み（occurrenceCount>1）の unknown を最優先で選ぶ", () => {
    const single = approved({ id: "single", occurrenceCount: 1 });
    const repeated = approved({ id: "repeated", occurrenceCount: 3 });
    expect(selectLifecycleAlert([single, repeated])?.id).toBe("repeated");
  });

  it("再発が無ければ patternName を持つ最新（先頭）の unknown を選ぶ", () => {
    const newest = approved({ id: "newest" });
    const older = approved({ id: "older" });
    expect(selectLifecycleAlert([newest, older])?.id).toBe("newest");
  });

  it("known 分類や patternName 空は代表から除外する", () => {
    const known = approved({ id: "known", classificationType: "known" });
    const blank = approved({ id: "blank", patternName: "  " });
    const nullName = approved({ id: "nullName", patternName: null });
    const ok = approved({ id: "ok" });
    expect(selectLifecycleAlert([known, blank, nullName, ok])?.id).toBe("ok");
  });

  it("代表がいなければ null（empty state へ劣化）", () => {
    expect(selectLifecycleAlert([])).toBeNull();
    expect(
      selectLifecycleAlert([approved({ classificationType: "known" })]),
    ).toBeNull();
  });
});

describe("patternLabel", () => {
  it("デモの既知パターンIDは日本語ラベルへ写す", () => {
    expect(patternLabel("DB_CONNECTION_POOL_EXHAUSTION")).toBe(
      "DB接続プールの枯渇",
    );
    expect(patternLabel("PAYMENT_PROVIDER_OUTAGE")).toBe("決済プロバイダ障害");
  });

  it("辞書外の UPPER_SNAKE は `_`→空白・小文字のハウススタイルへ", () => {
    expect(patternLabel("SOME_UNKNOWN_PATTERN")).toBe("some unknown pattern");
  });

  it("機械IDでない文章はそのまま返す", () => {
    expect(patternLabel("決済の一時的な失敗")).toBe("決済の一時的な失敗");
  });

  it("空・null は null（呼び出し側で placeholder に倒す）", () => {
    expect(patternLabel(null)).toBeNull();
    expect(patternLabel("  ")).toBeNull();
  });
});
