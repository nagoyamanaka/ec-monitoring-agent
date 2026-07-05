import { describe, it, expect } from "vitest";
import { calibrationNote } from "./confidenceCalibration";

describe("calibrationNote", () => {
  it("シグナルを日本語ラベルで列挙し、上限を併記する", () => {
    const note = calibrationNote(
      { signals: ["related_alert", "similar_incident"], cap: 0.7, original: 0.8 },
      0.7,
    );

    expect(note.basis).toBe("裏付け: 相関アラート・類似事例 ─ 確信度上限 70%");
    expect(note.adjustment).toBe(
      "AI 自己申告 80% を裏付け上限で 70% に補正済み",
    );
  });

  it("実在 CVE 引用（verifiable_cve）を日本語ラベルで出す", () => {
    const note = calibrationNote(
      { signals: ["verifiable_cve"], cap: 0.75, original: 0.95 },
      0.75,
    );

    expect(note.basis).toBe("裏付け: 実在 CVE 引用 ─ 確信度上限 75%");
  });

  it("裏付けゼロは「証拠なし」と正直に言う", () => {
    const note = calibrationNote({ signals: [], cap: 0.4, original: 0.9 }, 0.4);

    expect(note.basis).toBe("裏付けとなる証拠なし ─ 確信度上限 40%");
    expect(note.adjustment).toBe(
      "AI 自己申告 90% を裏付け上限で 40% に補正済み",
    );
  });

  it("切り詰めが起きていなければ補正説明は出さない（自己申告そのまま）", () => {
    const note = calibrationNote(
      { signals: ["known_pattern", "similar_incident"], cap: 0.9, original: 0.87 },
      0.87,
    );

    expect(note.basis).toBe("裏付け: 既知パターン一致・類似事例 ─ 確信度上限 90%");
    expect(note.adjustment).toBeNull();
  });
});
