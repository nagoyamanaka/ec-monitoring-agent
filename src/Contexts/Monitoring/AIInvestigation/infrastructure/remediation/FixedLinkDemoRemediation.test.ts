import { describe, expect, it } from "vitest";
import { FixedLinkDemoRemediation } from "./FixedLinkDemoRemediation.js";
import { RemediationInput } from "../../domain/remediation/RemediationInput.js";

const input: RemediationInput = {
  alertId: "alert-1",
  repo: "owner/repo",
  vulnerabilities: [
    {
      cveId: "CVE-2021-3807",
      severity: "HIGH",
      package: "ansi-regex",
      version: "4.1.0",
      fixedVersion: "5.0.1",
    },
  ],
};

describe("FixedLinkDemoRemediation", () => {
  it("設定された本物のPR URLを drafted として返す", async () => {
    const url = "https://github.com/owner/repo/pull/42";
    const result = await new FixedLinkDemoRemediation(url).execute(input);

    expect(result).toEqual({ kind: "drafted", pullRequestUrl: url });
  });

  it("URL 未設定なら空リンクを drafted せず failed を返す", async () => {
    const result = await new FixedLinkDemoRemediation("").execute(input);

    expect(result.kind).toBe("failed");
  });
});
