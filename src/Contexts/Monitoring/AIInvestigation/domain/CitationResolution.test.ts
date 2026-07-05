import { describe, it, expect } from "vitest";
import {
  buildCitationCatalog,
  resolveCitations,
  type CitationCatalogContext,
} from "./CitationResolution.js";
import type { InfraEvidence } from "./InfraEvidence.js";

const evidence: InfraEvidence = {
  appLogs: [],
  recentCommits: [
    {
      sha: "e12b655abc9f00112233445566778899aabbccdd",
      message: "perf: pool 縮小",
      author: "dev",
      committedAt: new Date("2026-07-04T06:00:00.000Z"),
      url: "https://github.com/acme/ec/commit/e12b655abc9f00112233445566778899aabbccdd",
    },
  ],
  terraformDiff: {
    resourceChanges: [
      {
        address: "google_sql_database_instance.main",
        action: "update",
        attributeDeltas: [],
      },
    ],
    appliedAt: "2026-07-04T06:00:00.000Z",
    commitSha: "740498f",
    url: "https://github.com/acme/ec/pull/26",
    changedResources: ["google_sql_database_instance.main"],
    summary: "max_connections 100 → 40",
  },
  metrics: [
    {
      metricType: "run.googleapis.com/request_count_5xx",
      displayName: "5xx リクエスト数",
      latest: 120,
      max: 300,
      points: 12,
    },
  ],
  collectedAt: new Date("2026-07-04T07:23:00.000Z"),
};

const context: CitationCatalogContext = {
  errorEvent: { eventName: "ec.db.connection_pool_exhausted" },
  knownPatterns: [{ name: "PROMOTED_EC.DB.CONNECTION_POOL_EXHAUSTED" }],
  similarIncidents: [{ eventName: "ec.payment.timeout" }],
  infraEvidence: evidence,
};

describe("buildCitationCatalog", () => {
  it("イベント名・パターン名・commit・terraform・メトリクス・類似事例を種別付きで集める", () => {
    const catalog = buildCitationCatalog(context);
    const byKind = (kind: string) => catalog.filter((e) => e.kind === kind);
    expect(byKind("event").map((e) => e.id)).toEqual(["ec.db.connection_pool_exhausted"]);
    expect(byKind("pattern").map((e) => e.id)).toEqual([
      "PROMOTED_EC.DB.CONNECTION_POOL_EXHAUSTED",
    ]);
    expect(byKind("commit")[0]?.href).toContain("/commit/e12b655");
    // terraform はアドレス（重複除去）＋由来 sha、リンクは差分の PR。
    expect(byKind("terraform").map((e) => e.id)).toEqual([
      "google_sql_database_instance.main",
      "740498f",
    ]);
    expect(byKind("terraform")[0]?.href).toBe("https://github.com/acme/ec/pull/26");
    expect(byKind("metric").map((e) => e.id)).toEqual([
      "run.googleapis.com/request_count_5xx",
      "5xx リクエスト数",
    ]);
    expect(byKind("incident").map((e) => e.id)).toEqual(["ec.payment.timeout"]);
  });

  it("証拠なしでもイベント名だけのカタログになる（空クラッシュしない）", () => {
    const catalog = buildCitationCatalog({
      errorEvent: { eventName: "ec.checkout.failed" },
    });
    expect(catalog).toEqual([{ id: "ec.checkout.failed", kind: "event" }]);
  });
});

describe("resolveCitations", () => {
  const catalog = buildCitationCatalog(context);

  it("イベント名そのままの引用は event に解決する", () => {
    const [ref] = resolveCitations(["ec.db.connection_pool_exhausted"], catalog);
    expect(ref).toEqual({
      value: "ec.db.connection_pool_exhausted",
      kind: "event",
    });
  });

  it("PROMOTED_ 付き引用はイベント名も内包するが、最長一致でパターンに解決する", () => {
    const [ref] = resolveCitations(["PROMOTED_EC.DB.CONNECTION_POOL_EXHAUSTED"], catalog);
    expect(ref?.kind).toBe("pattern");
  });

  it("省略 sha（7文字）の引用は id 側包含で commit に解決し、リンクが付く", () => {
    const [ref] = resolveCitations(["e12b655"], catalog);
    expect(ref?.kind).toBe("commit");
    expect(ref?.href).toContain("/commit/e12b655");
  });

  it("短すぎる引用（7文字未満）は部分一致させず未照合として残す", () => {
    const [ref] = resolveCitations(["e12b65"], catalog);
    expect(ref).toEqual({ value: "e12b65" });
  });

  it("カタログに無い引用は落とさず kind 未設定（未照合）で残す＝件数と順序は入力と同じ", () => {
    const refs = resolveCitations(
      ["appLogs: 謎のログ", "740498f", "ec.payment.timeout"],
      catalog,
    );
    expect(refs.map((r) => r.kind)).toEqual([undefined, "terraform", "incident"]);
    expect(refs.map((r) => r.value)).toEqual([
      "appLogs: 謎のログ",
      "740498f",
      "ec.payment.timeout",
    ]);
  });

  it("照合は case-insensitive（引用が大文字でも解決する）", () => {
    const [ref] = resolveCitations(["RUN.GOOGLEAPIS.COM/REQUEST_COUNT_5XX"], catalog);
    expect(ref?.kind).toBe("metric");
  });
});
