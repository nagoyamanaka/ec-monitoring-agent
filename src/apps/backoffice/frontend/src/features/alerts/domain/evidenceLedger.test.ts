import { describe, expect, it } from "vitest";
import { evidenceLedgerKeys } from "./evidenceLedger";
import type { InvestigationMetricsView } from "./InvestigationReportView";

const ZERO: InvestigationMetricsView["evidenceCounts"] = {
  logs: 0,
  metrics: 0,
  terraformChanges: 0,
  commits: 0,
  similarIncidents: 0,
};

describe("evidenceLedgerKeys", () => {
  it("INFRASTRUCTURE はログ・メトリクス・Terraform・過去事例（コミットは調査対象外）", () => {
    expect(evidenceLedgerKeys("INFRASTRUCTURE", ZERO, 0)).toEqual([
      "logs",
      "metrics",
      "terraformChanges",
      "similarIncidents",
    ]);
  });

  it("CAPACITY はログ・メトリクス・過去事例", () => {
    expect(evidenceLedgerKeys("CAPACITY", ZERO, 0)).toEqual([
      "logs",
      "metrics",
      "similarIncidents",
    ]);
  });

  it("APPLICATION はログ・コミット・過去事例", () => {
    expect(evidenceLedgerKeys("APPLICATION", ZERO, 0)).toEqual([
      "logs",
      "commits",
      "similarIncidents",
    ]);
  });

  it("SECURITY は CVE があればスキャンを先頭に加える", () => {
    expect(evidenceLedgerKeys("SECURITY", ZERO, 2)).toEqual([
      "security",
      "logs",
      "commits",
      "similarIncidents",
    ]);
  });

  it("SECURITY でも CVE 0 件ならスキャンセルは立てない（調査収集でなく検知 payload 由来）", () => {
    expect(evidenceLedgerKeys("SECURITY", ZERO, 0)).toEqual([
      "logs",
      "commits",
      "similarIncidents",
    ]);
  });

  it("category 対象外でも実測 >0 の証拠源は必ず載せる（証拠を隠さない防御）", () => {
    expect(
      evidenceLedgerKeys("APPLICATION", { ...ZERO, terraformChanges: 2 }, 0),
    ).toEqual(["logs", "terraformChanges", "commits", "similarIncidents"]);
  });
});
