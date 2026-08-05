import { describe, expect, it } from "vitest";
import { buildForecastTimeline, formatDurationJa } from "./ForecastTimeline";
import type { CitationView, RiskCardView } from "./ForecastView";

const scheduleCitation: CitationView = {
  id: "sch-1",
  kind: "SCHEDULE",
  kindLabel: "スケジュール",
  subject: "checkout",
  when: "土 20:00-23:00",
  desc: "checkout 負荷 x5（週末セール）",
};

const memoryCitation: CitationView = {
  id: "inc-1",
  kind: "MEMORY",
  kindLabel: "過去の同型事例",
  subject: "db_connection_pool",
  when: "過去の解決済みインシデント",
  desc: "接続プール枯渇",
};

function riskWith(citations: CitationView[]): RiskCardView {
  return {
    window: "土 20:00-23:00",
    subject: "db_connection_pool",
    level: "HIGH",
    confidence: 0.9,
    reasoning: "…",
    citations,
  };
}

// 本番予報の実発行時刻: JST 2026-08-04(火) 15:13
const generatedAt = "2026-08-04T06:13:51.238Z";

describe("buildForecastTimeline", () => {
  it("引用スケジュールから3点（いま・期限・予測発生）を決定論で置く", () => {
    const timeline = buildForecastTimeline(
      riskWith([scheduleCitation, memoryCitation]),
      generatedAt,
    );

    expect(timeline?.predictedAt.toISOString()).toBe("2026-08-08T11:00:00.000Z");
    // 予測発生 − 対処30分（宣言値）
    expect(timeline?.deadlineAt.toISOString()).toBe("2026-08-08T10:30:00.000Z");
    expect(timeline?.windowEndsAt?.toISOString()).toBe("2026-08-08T14:00:00.000Z");
    expect(timeline?.remediationMinutes).toBe(30);
    expect(timeline?.tooLate).toBe(false);
  });

  it("時刻の出所（スケジュール原文）を持ち回る＝画面で検算できる", () => {
    const timeline = buildForecastTimeline(riskWith([scheduleCitation]), generatedAt);

    expect(timeline?.scheduleSource).toBe("土 20:00-23:00");
  });

  it("スケジュールを引用していないリスクでは軸を出さない（LLM の window は読まない）", () => {
    expect(buildForecastTimeline(riskWith([memoryCitation]), generatedAt)).toBeUndefined();
    expect(buildForecastTimeline(riskWith([]), generatedAt)).toBeUndefined();
  });

  it("区間は 0..1 で並び、判断区間 → 対処 → 発生窓 の順に隙間なく続く", () => {
    const timeline = buildForecastTimeline(riskWith([scheduleCitation]), generatedAt);
    if (!timeline) throw new Error("timeline");

    expect(timeline.decisionSegment.start).toBe(0);
    expect(timeline.decisionSegment.end).toBeCloseTo(timeline.remediationSegment.start, 10);
    expect(timeline.remediationSegment.end).toBeCloseTo(timeline.windowSegment.start, 10);
    expect(timeline.windowSegment.end).toBe(1);
    // 103時間の軸に対して対処30分＝線形なら 0.5% 未満。太らせない（見え方を歪めない）。
    expect(timeline.remediationSegment.end - timeline.remediationSegment.start).toBeLessThan(0.01);
  });

  it("間に合わない予報は判断区間を幅ゼロに畳み、tooLate を立てる", () => {
    // 発生 10分前に発行された予報（対処30分に届かない）
    const timeline = buildForecastTimeline(
      riskWith([scheduleCitation]),
      "2026-08-08T10:50:00.000Z",
    );
    if (!timeline) throw new Error("timeline");

    expect(timeline.tooLate).toBe(true);
    expect(timeline.effectiveMinutes).toBe(-20); // 負を丸めない
    expect(timeline.decisionSegment.end).toBe(0); // 軸を巻き戻して「まだ間に合う」ように見せない
  });

  it("複数のスケジュールを引用していたら早いほうを採る（猶予を長く見せない）", () => {
    const earlier: CitationView = { ...scheduleCitation, id: "sch-2", when: "水 09:00-12:00" };
    const timeline = buildForecastTimeline(
      riskWith([scheduleCitation, earlier]),
      generatedAt,
    );

    expect(timeline?.scheduleSource).toBe("水 09:00-12:00");
  });

  it("終了時刻が書かれていない窓は、終わりを主張しない", () => {
    const openEnded: CitationView = { ...scheduleCitation, when: "土 20:00" };
    const timeline = buildForecastTimeline(riskWith([openEnded]), generatedAt);

    expect(timeline?.predictedAt.toISOString()).toBe("2026-08-08T11:00:00.000Z");
    expect(timeline?.windowEndsAt).toBeUndefined();
  });
});

describe("formatDurationJa", () => {
  it("時間と分で出す（丸めで猶予を長く見せない）", () => {
    expect(formatDurationJa(6016)).toBe("100時間16分");
    expect(formatDurationJa(120)).toBe("2時間");
    expect(formatDurationJa(45)).toBe("45分");
    expect(formatDurationJa(-20)).toBe("20分"); // 符号は呼び出し側の文言が持つ
  });
});
