import { describe, expect, it } from "vitest";
import { makeAlert, makeReport } from "../test-support/alertFixture";
import type { AlertView } from "./AlertView";
import {
  collectCorrelatedRefs,
  collectPastIncidentRefs,
  pastMatchLabel,
  relationLabel,
  toPastIncidentViews,
  toRelatedAlertViews,
} from "./relatedAlerts";

describe("relationLabel", () => {
  it("既知の関係コードは人間語へ写像する", () => {
    expect(relationLabel("same_root_cause")).toBe("同一根本原因");
    expect(relationLabel("downstream")).toBe("波及（下流）");
    expect(relationLabel("precursor")).toBe("予兆");
  });

  it("未知の関係コードはそのまま返す", () => {
    expect(relationLabel("mystery")).toBe("mystery");
  });
});

describe("collectCorrelatedRefs", () => {
  it("AI 相関（report.relatedAlerts）を集約する", () => {
    const alert = makeAlert({
      report: makeReport({
        relatedAlerts: [
          { alertId: "b", relation: "downstream", rationale: "波及した" },
        ],
      }),
    });
    expect(collectCorrelatedRefs(alert)).toEqual([
      { alertId: "b", relation: "downstream", rationale: "波及した" },
    ]);
  });

  it("relation=similar は過去の同型なので関連には含めない", () => {
    const alert = makeAlert({
      report: makeReport({
        relatedAlerts: [
          { alertId: "b", relation: "similar", rationale: "過去の同型" },
          { alertId: "c", relation: "upstream", rationale: "起因" },
        ],
      }),
    });
    expect(collectCorrelatedRefs(alert).map((r) => r.alertId)).toEqual(["c"]);
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
    const refs = collectCorrelatedRefs(alert);
    expect(refs.map((r) => r.alertId)).toEqual(["b"]);
    expect(refs[0].rationale).toBe("1回目");
  });

  it("関連が無ければ空配列", () => {
    expect(collectCorrelatedRefs(makeAlert({ report: makeReport() }))).toEqual(
      [],
    );
  });
});

describe("collectPastIncidentRefs", () => {
  const similarityAlert = (): AlertView =>
    makeAlert({
      report: null,
      classification: {
        type: "known",
        source: "SIMILARITY",
        patternId: "p",
        patternName: "類似既知",
        confidence: 0.67,
        matchedConditions: [],
        sourceAlertId: "past-1",
      },
    });

  it("SIMILARITY の back-link を類似度付きの過去事例として加える", () => {
    const refs = collectPastIncidentRefs(similarityAlert());
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      alertId: "past-1",
      match: "similar",
      confidence: 0.67,
    });
  });

  it("back-link に resolvedNote があれば「当時の対応」を根拠に出す", () => {
    const alert = makeAlert({
      report: null,
      classification: {
        type: "known",
        source: "SIMILARITY",
        patternId: "p",
        patternName: "類似既知",
        confidence: 0.67,
        matchedConditions: [],
        sourceAlertId: "past-1",
        resolvedNote: "接続プール上限を拡張して復旧",
      },
    });
    const refs = collectPastIncidentRefs(alert);
    expect(refs[0].rationale).toBe("当時の対応: 接続プール上限を拡張して復旧");
  });

  it("SIMILARITY 分類でも一覧から同 eventName の対処済み過去アラートを「一致」で引く", () => {
    const alert = makeAlert({
      id: "self",
      eventName: "ec.db.connection_pool_exhausted",
      report: null,
      classification: {
        type: "known",
        source: "SIMILARITY",
        patternId: "p",
        patternName: "類似既知",
        confidence: 0.67,
        matchedConditions: [],
        sourceAlertId: "seed-past",
      },
    });
    const corpus = [
      alert,
      // 直前に承認した同型（学習の可視化＝1回目の承認済みアラートがここに出る）。
      makeAlert({
        id: "approved-run1",
        eventName: "ec.db.connection_pool_exhausted",
        feedback: { isCorrect: true },
        occurredOn: "2026-07-06T07:46:59.000Z",
      }),
      // 未対処は含めない。
      makeAlert({ id: "open-1", eventName: "ec.db.connection_pool_exhausted" }),
    ];

    const refs = collectPastIncidentRefs(alert, corpus);
    // back-link（seed）が先勝ち、corpus の承認済み同型が「一致」で続く。
    expect(refs.map((r) => [r.alertId, r.match])).toEqual([
      ["seed-past", "similar"],
      ["approved-run1", "exact"],
    ]);
  });

  it("AI 相関の relation=similar を過去事例として加える", () => {
    const alert = makeAlert({
      report: makeReport({
        relatedAlerts: [
          { alertId: "b", relation: "similar", rationale: "過去の同型" },
          { alertId: "c", relation: "downstream", rationale: "波及（対象外）" },
        ],
      }),
    });
    const refs = collectPastIncidentRefs(alert);
    expect(refs).toEqual([
      {
        alertId: "b",
        match: "similar",
        rationale: "過去の同型",
      },
    ]);
  });

  it("EXACT_MATCH 分類は一覧から同 eventName の対処済み過去アラートを直近順に引く", () => {
    const alert = makeAlert({
      id: "self",
      eventName: "ec.payment.timeout",
      classification: {
        type: "known",
        source: "EXACT_MATCH",
        patternId: "p",
        patternName: "決済タイムアウト",
        confidence: 1,
        matchedConditions: [],
      },
      report: null,
    });
    const corpus = [
      alert,
      // 承認済み（feedback 正）＝過去事例に含む。
      makeAlert({
        id: "approved-old",
        eventName: "ec.payment.timeout",
        feedback: { isCorrect: true },
        occurredOn: "2026-06-01T00:00:00.000Z",
      }),
      makeAlert({
        id: "approved-new",
        eventName: "ec.payment.timeout",
        feedback: { isCorrect: true },
        occurredOn: "2026-06-20T00:00:00.000Z",
      }),
      // RESOLVED も含む。
      makeAlert({
        id: "resolved-1",
        eventName: "ec.payment.timeout",
        status: "RESOLVED",
        occurredOn: "2026-06-10T00:00:00.000Z",
      }),
      // 未対処（OPEN・feedback なし）は含めない。
      makeAlert({ id: "open-1", eventName: "ec.payment.timeout" }),
      // 別 eventName は含めない。
      makeAlert({
        id: "other-event",
        eventName: "ec.inventory.conflict",
        feedback: { isCorrect: true },
      }),
    ];

    const refs = collectPastIncidentRefs(alert, corpus);
    expect(refs.map((r) => r.alertId)).toEqual([
      "approved-new",
      "resolved-1",
      "approved-old",
    ]);
    expect(refs[0].match).toBe("exact");
  });

  it("完全一致の過去事例は直近3件に絞る", () => {
    const alert = makeAlert({
      id: "self",
      eventName: "e",
      classification: {
        type: "known",
        source: "EXACT_MATCH",
        patternId: "p",
        patternName: "既知",
        confidence: 1,
        matchedConditions: [],
      },
      report: null,
    });
    const corpus = ["a", "b", "c", "d"].map((id, i) =>
      makeAlert({
        id,
        eventName: "e",
        feedback: { isCorrect: true },
        occurredOn: `2026-06-0${i + 1}T00:00:00.000Z`,
      }),
    );
    expect(collectPastIncidentRefs(alert, corpus)).toHaveLength(3);
  });

  it("重複 alertId は先勝ち（確度付き back-link 優先）で除外する", () => {
    const alert = makeAlert({
      report: makeReport({
        relatedAlerts: [
          { alertId: "past-1", relation: "similar", rationale: "AI が発見" },
        ],
      }),
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
    const refs = collectPastIncidentRefs(alert);
    expect(refs).toHaveLength(1);
    expect(refs[0].confidence).toBe(0.8);
  });

  it("過去事例が無ければ空配列", () => {
    expect(collectPastIncidentRefs(makeAlert({ report: makeReport() }))).toEqual(
      [],
    );
  });
});

describe("pastMatchLabel", () => {
  it("完全一致は「一致」、類似は類似度%で段階表示する", () => {
    expect(
      pastMatchLabel({ alertId: "a", match: "exact", rationale: "" }),
    ).toBe("一致");
    expect(
      pastMatchLabel({
        alertId: "a",
        match: "similar",
        confidence: 0.667,
        rationale: "",
      }),
    ).toBe("類似 67%");
    expect(
      pastMatchLabel({ alertId: "a", match: "similar", rationale: "" }),
    ).toBe("類似");
  });
});

describe("toRelatedAlertViews", () => {
  const refs = [
    { alertId: "b", relation: "downstream", rationale: "波及" },
    { alertId: "missing", relation: "upstream", rationale: "起因" },
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

describe("toPastIncidentViews", () => {
  it("lookup で解決できた過去事例は日時/severity/タイトルを補完する", () => {
    const resolved = makeAlert({
      id: "past-1",
      eventName: "ec.payment.timeout",
      severity: "CRITICAL",
      occurredOn: "2026-06-10T00:00:00.000Z",
    });
    const views = toPastIncidentViews(
      [
        {
          alertId: "past-1",
          match: "similar",
          confidence: 0.67,
          rationale: "過去に解決済み",
        },
        { alertId: "missing", match: "exact", rationale: "対処済み" },
      ],
      (id) => (id === "past-1" ? resolved : undefined),
    );

    expect(views[0]).toMatchObject({
      alertId: "past-1",
      resolved: true,
      title: "ec.payment.timeout",
      matchLabel: "類似 67%",
    });
    expect(views[1]).toMatchObject({
      alertId: "missing",
      resolved: false,
      matchLabel: "一致",
    });
  });
});
