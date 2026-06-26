import { describe, it, expect } from "vitest";
import { buildEvidenceLinks } from "./evidenceLinks.js";
import type { InfraEvidence } from "../../domain/InfraEvidence.js";

function evidence(overrides: Partial<InfraEvidence> = {}): InfraEvidence {
  return {
    appLogs: [],
    collectedAt: new Date("2026-06-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildEvidenceLinks", () => {
  it("evidence が undefined なら空", () => {
    expect(buildEvidenceLinks(undefined, { githubRepo: "o/r" })).toEqual([]);
  });

  it("直近コミットを GitHub commit リンクへ（repo 設定時）", () => {
    const links = buildEvidenceLinks(
      evidence({
        recentCommits: [
          { sha: "abc1234", message: "fix bug", author: "a", committedAt: new Date() },
        ],
      }),
      { githubRepo: "example-org/ec-backend" },
    );

    expect(links).toEqual([
      {
        text: "コミット abc1234: fix bug",
        href: "https://github.com/example-org/ec-backend/commit/abc1234",
        kind: "code",
      },
    ]);
  });

  it("repo 未設定ならコミットリンクを出さない", () => {
    const links = buildEvidenceLinks(
      evidence({
        recentCommits: [
          { sha: "abc1234", message: "m", author: "a", committedAt: new Date() },
        ],
      }),
      {},
    );
    expect(links).toEqual([]);
  });

  it("ERROR ログのリソースを Cloud Logging リンクへ（project 設定時・重複排除）", () => {
    const links = buildEvidenceLinks(
      evidence({
        appLogs: [
          { timestamp: new Date(), severity: "ERROR", message: "x", resource: "payment-api" },
          { timestamp: new Date(), severity: "ERROR", message: "y", resource: "payment-api" },
          { timestamp: new Date(), severity: "WARNING", message: "z", resource: "order-api" },
        ],
      }),
      { gcpProjectId: "my-proj" },
    );

    // payment-api は1本に重複排除、WARNING の order-api は対象外
    expect(links).toHaveLength(1);
    expect(links[0].kind).toBe("log");
    expect(links[0].text).toContain("payment-api");
    expect(links[0].href).toContain("project=my-proj");
    expect(links[0].href).toContain(encodeURIComponent('service_name="payment-api"'));
  });

  it("project 未設定ならログリンクを出さない", () => {
    const links = buildEvidenceLinks(
      evidence({
        appLogs: [{ timestamp: new Date(), severity: "ERROR", message: "x", resource: "r" }],
      }),
      {},
    );
    expect(links).toEqual([]);
  });

  it("コミットとログの両方を設定どおり結合する", () => {
    const links = buildEvidenceLinks(
      evidence({
        recentCommits: [{ sha: "deadbee", message: "m", author: "a", committedAt: new Date() }],
        appLogs: [{ timestamp: new Date(), severity: "ERROR", message: "x", resource: "svc" }],
      }),
      { githubRepo: "o/r", gcpProjectId: "p" },
    );

    expect(links.map((l) => l.kind)).toEqual(["code", "log"]);
  });
});
