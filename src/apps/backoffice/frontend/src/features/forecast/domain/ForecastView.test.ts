import { describe, expect, it } from "vitest";
import type {
  ForecastBriefingPrimitives,
  ForecastSignalPrimitives,
  RiskItemPrimitives,
} from "@monitoring/Forecast/domain/contracts/ForecastContract";
import {
  citationKindCount,
  convergenceLanes,
  groupCitationsByKind,
  incidentAlertId,
  pastIncidentCount,
  riskSubjectLabel,
  signalKindLabel,
  toForecastBriefingView,
  type CitationView,
} from "./ForecastView";

const signal = (
  over: Partial<ForecastSignalPrimitives> = {},
): ForecastSignalPrimitives => ({
  id: "sig-1",
  kind: "FUTURE_CHANGE",
  subject: "db.connection_pool",
  when: "マージ後",
  desc: "pool 100→40 に縮小する未マージ PR",
  source: "github.pr.42",
  ...over,
});

const risk = (over: Partial<RiskItemPrimitives> = {}): RiskItemPrimitives => ({
  window: "土曜 20:00-22:00",
  subject: "db.connection_pool",
  level: "HIGH",
  confidence: 0.8,
  citations: ["sig-1"],
  reasoning: "接続上限縮小と負荷スケジュールが重なる",
  ...over,
});

const briefing = (
  risks: RiskItemPrimitives[],
  signals: ForecastSignalPrimitives[],
): ForecastBriefingPrimitives => ({
  forecast: {
    forecastId: "f-1",
    generatedAt: "2026-07-03T10:00:00.000Z",
    horizon: "今週末",
    risks,
    isFallback: false,
  },
  signals,
});

describe("toForecastBriefingView", () => {
  it("citations を同梱シグナルへ解決し、種別ラベル・URL を付与する", () => {
    const view = toForecastBriefingView(
      briefing(
        [risk()],
        [signal({ url: "https://github.com/x/y/pull/42" })],
      ),
    );
    expect(view.risks[0].citations).toHaveLength(1);
    const c = view.risks[0].citations[0];
    expect(c.kindLabel).toBe("未来の変更");
    expect(c.url).toBe("https://github.com/x/y/pull/42");
    expect(c.alertId).toBeUndefined();
  });

  it("MEMORY 引用は source の incident.<id> からアラート id を解決する", () => {
    const view = toForecastBriefingView(
      briefing(
        [risk({ citations: ["sig-m"] })],
        [
          signal({
            id: "sig-m",
            kind: "MEMORY",
            source: "incident.alert-123",
          }),
        ],
      ),
    );
    const c = view.risks[0].citations[0];
    expect(c.kindLabel).toBe("過去の同型事例");
    expect(c.alertId).toBe("alert-123");
  });

  it("preventiveAction（先手・F11a）はそのまま射影し、欠落時はフィールドごと出さない", () => {
    const view = toForecastBriefingView(
      briefing(
        [
          risk({ preventiveAction: "PR のマージをセール後へ延期する。" }),
          risk({ level: "LOW" }),
        ],
        [signal()],
      ),
    );
    expect(view.risks[0].preventiveAction).toBe(
      "PR のマージをセール後へ延期する。",
    );
    expect(view.risks[1].preventiveAction).toBeUndefined();
  });

  it("解決できない引用 id は表示から落とす（防御）", () => {
    const view = toForecastBriefingView(
      briefing([risk({ citations: ["sig-1", "ghost"] })], [signal()]),
    );
    expect(view.risks[0].citations.map((c) => c.id)).toEqual(["sig-1"]);
  });

  it("risks を level 降順→confidence 降順に並べ、highRiskCount を数える", () => {
    const view = toForecastBriefingView(
      briefing(
        [
          risk({ level: "LOW", confidence: 0.9 }),
          risk({ level: "HIGH", confidence: 0.5 }),
          risk({ level: "HIGH", confidence: 0.7 }),
        ],
        [signal()],
      ),
    );
    expect(view.risks.map((r) => [r.level, r.confidence])).toEqual([
      ["HIGH", 0.7],
      ["HIGH", 0.5],
      ["LOW", 0.9],
    ]);
    expect(view.highRiskCount).toBe(2);
  });

  it("未知 level は LOW へ丸め、confidence はクランプする", () => {
    const view = toForecastBriefingView(
      briefing(
        [
          risk({
            level: "CRITICAL" as RiskItemPrimitives["level"],
            confidence: 1.5,
          }),
        ],
        [signal()],
      ),
    );
    expect(view.risks[0].level).toBe("LOW");
    expect(view.risks[0].confidence).toBe(1);
  });

  it("メタ情報（horizon/isFallback/signalCount）を写す", () => {
    const view = toForecastBriefingView(
      briefing([], [signal(), signal({ id: "sig-2" })]),
    );
    expect(view.horizon).toBe("今週末");
    expect(view.isFallback).toBe(false);
    expect(view.signalCount).toBe(2);
    expect(view.risks).toEqual([]);
  });
});

describe("signalKindLabel / incidentAlertId", () => {
  it("未知の kind は生値のまま返す（degrade）", () => {
    expect(signalKindLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });

  it("incident. プレフィックスが無い source は undefined", () => {
    expect(incidentAlertId({ source: "github.pr.42" })).toBeUndefined();
  });
});

describe("groupCitationsByKind / citationKindCount", () => {
  const citation = (over: Partial<CitationView> = {}): CitationView => ({
    id: "c-1",
    kind: "FUTURE_CHANGE",
    kindLabel: "未来の変更",
    subject: "db.connection_pool",
    when: "マージ後",
    desc: "pool 縮小",
    ...over,
  });

  it("語り順（変更予定→スケジュール→記憶）でレーンにまとめ、同種は同レーンに束ねる", () => {
    const lanes = groupCitationsByKind([
      citation({ id: "m-1", kind: "MEMORY", kindLabel: "過去の同型事例" }),
      citation({ id: "s-1", kind: "SCHEDULE", kindLabel: "スケジュール" }),
      citation({ id: "f-1" }),
      citation({ id: "f-2" }),
    ]);

    expect(lanes.map((l) => l.kind)).toEqual([
      "FUTURE_CHANGE",
      "SCHEDULE",
      "MEMORY",
    ]);
    expect(lanes[0].citations.map((c) => c.id)).toEqual(["f-1", "f-2"]);
    expect(lanes[0].kindLabel).toBe("未来の変更");
  });

  it("未知の kind は末尾レーンに degrade する（落とさない）", () => {
    const lanes = groupCitationsByKind([
      citation({ id: "x-1", kind: "SOMETHING_NEW", kindLabel: "SOMETHING_NEW" }),
      citation({ id: "s-1", kind: "SCHEDULE", kindLabel: "スケジュール" }),
    ]);
    expect(lanes.map((l) => l.kind)).toEqual(["SCHEDULE", "SOMETHING_NEW"]);
  });

  it("citationKindCount は系統数（重複除去）を返す", () => {
    expect(
      citationKindCount([
        citation({ id: "f-1" }),
        citation({ id: "f-2" }),
        citation({ id: "m-1", kind: "MEMORY" }),
      ]),
    ).toBe(2);
    expect(citationKindCount([])).toBe(0);
  });

  it("convergenceLanes は語り順のレーンごとに件数を数える（収束ミニフロー入力）", () => {
    const lanes = convergenceLanes([
      citation({ id: "m-1", kind: "MEMORY", kindLabel: "過去の同型事例" }),
      citation({ id: "f-1" }),
      citation({ id: "f-2" }),
    ]);
    expect(lanes).toEqual([
      { kind: "FUTURE_CHANGE", kindLabel: "未来の変更", count: 2 },
      { kind: "MEMORY", kindLabel: "過去の同型事例", count: 1 },
    ]);
    expect(convergenceLanes([])).toEqual([]);
  });

  it("pastIncidentCount は MEMORY 引用（過去の同型事例）の件数だけを数える", () => {
    expect(
      pastIncidentCount([
        citation({ id: "f-1" }),
        citation({ id: "m-1", kind: "MEMORY" }),
        citation({ id: "m-2", kind: "MEMORY" }),
      ]),
    ).toBe(2);
    expect(pastIncidentCount([citation({ id: "f-1" })])).toBe(0);
  });
});

describe("riskSubjectLabel（E9: 生突合キーの表示専用人間語化）", () => {
  it("terraform アドレス正規化の生ID（flagship VM / Valkey plan）を人間語へ写像する", () => {
    expect(
      riskSubjectLabel("module_gce_backbone_google_compute_instance_backbone"),
    ).toBe("バックボーンVM（Mongo 同居・GCE）");
    expect(
      riskSubjectLabel(
        "module_valkey_cache_google_redis_instance_catalog_cache",
      ),
    ).toBe("カタログキャッシュ（Valkey）");
  });

  it("過去事例・stub・schedule 側の語彙も同じ写像に載る（ドット区切りも吸収）", () => {
    expect(riskSubjectLabel("google_compute_instance.backbone")).toBe(
      "バックボーンVM（Mongo 同居・GCE）",
    );
    expect(riskSubjectLabel("db_connection_pool")).toBe("DB接続プール");
    expect(riskSubjectLabel("valkey_cache_maxmemory")).toBe(
      "カタログキャッシュ（Valkey）",
    );
    expect(riskSubjectLabel("checkout")).toBe("チェックアウト（購入導線）");
  });

  it("checkout との複合語彙は DB接続プール側へ倒す（ルール順の固定）", () => {
    expect(riskSubjectLabel("checkout_db_connection_pool")).toBe(
      "DB接続プール",
    );
  });

  it("どのルールにも一致しない subject は原文のまま返す（防御・盛らない側）", () => {
    expect(riskSubjectLabel("DB 接続プール枯渇")).toBe("DB 接続プール枯渇");
    expect(riskSubjectLabel("google_sql_database_instance_ec_db")).toBe(
      "google_sql_database_instance_ec_db",
    );
    expect(riskSubjectLabel("")).toBe("");
  });
});
