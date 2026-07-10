import { describe, expect, it } from "vitest";
import { evidenceFlowModel } from "./evidenceFlow";
import { makeReport } from "../test-support/alertFixture";
import type { InvestigationMetricsView } from "./InvestigationReportView";

function metrics(
  counts: Partial<InvestigationMetricsView["evidenceCounts"]> = {},
  elapsedMs = 143_000,
): InvestigationMetricsView {
  return {
    elapsedMs,
    evidenceCounts: {
      logs: 0,
      metrics: 0,
      terraformChanges: 0,
      commits: 0,
      similarIncidents: 0,
      ...counts,
    },
  };
}

describe("evidenceFlowModel", () => {
  it("report 無し・fallback・metrics 無しでは null（図を捏造しない）", () => {
    expect(evidenceFlowModel(null)).toBeNull();
    expect(
      evidenceFlowModel(
        makeReport({ isFallback: true, metrics: metrics({ logs: 3 }) }),
      ),
    ).toBeNull();
    expect(evidenceFlowModel(makeReport())).toBeNull(); // metrics 無し（旧データ）
  });

  it("全ソース0件では null（流入が無いのに図は描かない）", () => {
    expect(evidenceFlowModel(makeReport({ metrics: metrics() }))).toBeNull();
  });

  it("件数 >0 のソースだけを実測値つきで返し、合計・経過時間・確信度を導出する", () => {
    const model = evidenceFlowModel(
      makeReport({
        confidence: 0.7,
        metrics: metrics({ logs: 4, commits: 6, similarIncidents: 5 }),
      }),
    );

    expect(model).not.toBeNull();
    expect(model!.sources.map((s) => [s.key, s.count])).toEqual([
      ["logs", 4],
      ["commits", 6],
      ["similarIncidents", 5],
    ]);
    expect(model!.evidenceTotal).toBe(15);
    expect(model!.elapsedLabel).toBe("143秒");
    expect(model!.confidence).toBe(0.7);
  });

  it("Trivy CVE（検知 payload 実測）は先頭の流入源として載り、合計・読み上げにも入る", () => {
    const model = evidenceFlowModel(
      makeReport({ metrics: metrics({ commits: 10 }) }),
      2,
    );

    expect(model).not.toBeNull();
    expect(model!.sources.map((s) => [s.key, s.count])).toEqual([
      ["security", 2],
      ["commits", 10],
    ]);
    expect(model!.evidenceTotal).toBe(12);
    expect(model!.ariaSummary).toContain("Trivy (CI スキャン) 2件");
  });

  it("CVE 0 件（省略）では従来どおり security ソースを出さない", () => {
    const model = evidenceFlowModel(
      makeReport({ metrics: metrics({ logs: 3 }) }),
    );
    expect(model!.sources.map((s) => s.key)).toEqual(["logs"]);
  });

  it("調査収集ゼロでも CVE があれば図を描く（SECURITY の主証拠を欠かさない）", () => {
    const model = evidenceFlowModel(makeReport({ metrics: metrics() }), 2);
    expect(model).not.toBeNull();
    expect(model!.sources.map((s) => s.key)).toEqual(["security"]);
  });

  it("コネクタ太さは離散3段階（1-2件 / 3-5件 / 6件以上）", () => {
    const model = evidenceFlowModel(
      makeReport({
        metrics: metrics({ logs: 1, commits: 3, similarIncidents: 12 }),
      }),
    );
    expect(model!.sources.map((s) => s.weight)).toEqual([1, 2, 3]);
  });

  it("ariaSummary は図と同じ実測を1文で読み上げる", () => {
    const model = evidenceFlowModel(
      makeReport({
        confidence: 0.7,
        metrics: metrics({ logs: 4 }),
      }),
    );
    expect(model!.ariaSummary).toBe(
      "143秒で Cloud Logging 4件 の証拠 4 件を収集し、AI 調査が1つの結論に収束（確信度 70%）",
    );
  });
});
