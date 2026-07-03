import { describe, expect, it } from "vitest";
import { formatElapsed, workloadSummary } from "./investigationWorkload";

describe("formatElapsed", () => {
  it("1 秒未満は「1秒未満」", () => {
    expect(formatElapsed(0)).toBe("1秒未満");
    expect(formatElapsed(999)).toBe("1秒未満");
  });

  it("秒単位に丸めて「N秒」（実測 92 秒級もそのまま秒表示）", () => {
    expect(formatElapsed(1000)).toBe("1秒");
    expect(formatElapsed(92_400)).toBe("92秒");
    expect(formatElapsed(134_000)).toBe("134秒");
  });
});

describe("workloadSummary", () => {
  it("metrics 未設定（旧データ）は null", () => {
    expect(workloadSummary(undefined)).toBeNull();
  });

  it("件数 > 0 のソースだけを横断ソースとして列挙し、合計を返す", () => {
    const summary = workloadSummary({
      elapsedMs: 92_000,
      evidenceCounts: {
        logs: 12,
        metrics: 0,
        terraformChanges: 1,
        commits: 10,
        similarIncidents: 5,
      },
    });
    expect(summary).toEqual({
      elapsedLabel: "92秒",
      sources: ["Cloud Logging", "Terraform", "GitHub", "類似事例DB"],
      evidenceTotal: 28,
    });
  });

  it("証拠 0 件でも elapsed は返す（ソースは空配列）", () => {
    const summary = workloadSummary({
      elapsedMs: 500,
      evidenceCounts: {
        logs: 0,
        metrics: 0,
        terraformChanges: 0,
        commits: 0,
        similarIncidents: 0,
      },
    });
    expect(summary).toEqual({
      elapsedLabel: "1秒未満",
      sources: [],
      evidenceTotal: 0,
    });
  });
});
