import { describe, expect, it } from "vitest";
import { makeAlert, makeReport } from "../test-support/alertFixture";
import {
  collectRelatedRefs,
  relationLabel,
  toRelatedAlertViews,
} from "./relatedAlerts";

describe("relationLabel", () => {
  it("既知の関係コードは人間語へ写像する", () => {
    expect(relationLabel("same_root_cause")).toBe("同一根本原因");
    expect(relationLabel("downstream")).toBe("波及（下流）");
    expect(relationLabel("similar")).toBe("同型");
  });

  it("未知の関係コードはそのまま返す", () => {
    expect(relationLabel("mystery")).toBe("mystery");
  });
});

describe("collectRelatedRefs", () => {
  it("AI 相関（report.relatedAlerts）を集約する", () => {
    const alert = makeAlert({
      report: makeReport({
        relatedAlerts: [
          { alertId: "b", relation: "downstream", rationale: "波及した" },
        ],
      }),
    });
    expect(collectRelatedRefs(alert)).toEqual([
      { alertId: "b", relation: "downstream", rationale: "波及した" },
    ]);
  });

  it("SIMILARITY の sourceAlertId を similar 関連として加える", () => {
    const alert = makeAlert({
      report: null,
      classification: {
        type: "known",
        source: "SIMILARITY",
        patternId: "p",
        patternName: "類似既知",
        confidence: 0.8,
        matchedConditions: [],
        sourceAlertId: "past-1",
      },
    });
    const refs = collectRelatedRefs(alert);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ alertId: "past-1", relation: "similar" });
  });

  it("自分自身と重複 alertId は除外する（先勝ち）", () => {
    const alert = makeAlert({
      id: "self",
      report: makeReport({
        relatedAlerts: [
          { alertId: "self", relation: "downstream", rationale: "自分" },
          { alertId: "b", relation: "downstream", rationale: "1回目" },
          { alertId: "b", relation: "upstream", rationale: "2回目（捨てる）" },
        ],
      }),
    });
    const refs = collectRelatedRefs(alert);
    expect(refs.map((r) => r.alertId)).toEqual(["b"]);
    expect(refs[0].rationale).toBe("1回目");
  });

  it("関連が無ければ空配列", () => {
    expect(collectRelatedRefs(makeAlert({ report: makeReport() }))).toEqual([]);
  });
});

describe("toRelatedAlertViews", () => {
  const refs = [
    { alertId: "b", relation: "downstream", rationale: "波及" },
    { alertId: "missing", relation: "similar", rationale: "同型" },
  ];

  it("lookup で解決できた関連は日時/severity/タイトルを補完する", () => {
    const resolved = makeAlert({
      id: "b",
      eventName: "ec.order.failed",
      severity: "WARNING",
      occurredOn: "2026-06-22T00:00:00.000Z",
    });
    const views = toRelatedAlertViews(refs, (id) =>
      id === "b" ? resolved : undefined,
    );

    expect(views[0]).toMatchObject({
      alertId: "b",
      resolved: true,
      title: "ec.order.failed",
      severity: "WARNING",
      relationLabel: "波及（下流）",
    });
    // 解決できない関連はリンク用の最小情報のみ（degrade）。
    expect(views[1]).toMatchObject({ alertId: "missing", resolved: false });
    expect(views[1].severity).toBeUndefined();
  });
});
