import { describe, expect, it } from "vitest";
import { resolveScheduleOccurrence } from "./scheduleWindowOccurrence.js";

// 2026-08-04T06:13:51Z ＝ JST 08-04(火) 15:13。本番予報の実際の発行時刻。
const issuedAt = new Date("2026-08-04T06:13:51.238Z");

describe("resolveScheduleOccurrence", () => {
  it("seed の書式を次の到来時刻へ解決する（本番実データ）", () => {
    const occurrence = resolveScheduleOccurrence("土 20:00-23:00", issuedAt);

    // JST 08-08(土) 20:00 ＝ UTC 08-08 11:00
    expect(occurrence?.startsAt.toISOString()).toBe("2026-08-08T11:00:00.000Z");
    expect(occurrence?.source).toBe("土 20:00-23:00");
  });

  it("英語表記（Schedule.ts の例）も読む", () => {
    const occurrence = resolveScheduleOccurrence("Sat 20:00-23:00", issuedAt);

    expect(occurrence?.startsAt.toISOString()).toBe("2026-08-08T11:00:00.000Z");
  });

  it("同じ曜日でも開始時刻を過ぎていれば翌週（「次に来る窓」が定義）", () => {
    // JST 08-08(土) 21:00 に発行＝その日の 20:00 は既に始まっている
    const afterStart = new Date("2026-08-08T12:00:00.000Z");

    expect(
      resolveScheduleOccurrence("土 20:00-23:00", afterStart)?.startsAt.toISOString(),
    ).toBe("2026-08-15T11:00:00.000Z");
  });

  it("同じ曜日で開始前ならその日（翌週へ飛ばさない）", () => {
    // JST 08-08(土) 10:00
    const beforeStart = new Date("2026-08-08T01:00:00.000Z");

    expect(
      resolveScheduleOccurrence("土 20:00-23:00", beforeStart)?.startsAt.toISOString(),
    ).toBe("2026-08-08T11:00:00.000Z");
  });

  it("曜日か開始時刻が読めなければ推測しない", () => {
    expect(resolveScheduleOccurrence("未マージ（merge され次第有効）", issuedAt)).toBeUndefined();
    expect(resolveScheduleOccurrence("土", issuedAt)).toBeUndefined();
    expect(resolveScheduleOccurrence("20:00-23:00", issuedAt)).toBeUndefined();
    expect(resolveScheduleOccurrence("過去の解決済みインシデント", issuedAt)).toBeUndefined();
  });

  it("日付の「日」を日曜と誤読しない（曜日は独立トークンのみ）", () => {
    // "8日" の日 を Sunday と読むと、丸4日ぶんリードタイムがずれる
    expect(resolveScheduleOccurrence("8日 20:00 開始", issuedAt)).toBeUndefined();
  });

  it("業務タイムゾーンは JST 固定（DST が無いので厳密）", () => {
    // JST 日曜 00:30 ＝ UTC 土曜 15:30。UTC 基準で解くと曜日を1つ間違える
    const occurrence = resolveScheduleOccurrence("日 00:30", issuedAt);

    expect(occurrence?.startsAt.toISOString()).toBe("2026-08-08T15:30:00.000Z");
  });
});
