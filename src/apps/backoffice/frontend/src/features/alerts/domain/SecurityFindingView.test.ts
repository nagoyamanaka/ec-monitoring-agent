import { describe, expect, it } from "vitest";
import { securityFindingsFromPayload } from "./SecurityFindingView";

describe("securityFindingsFromPayload", () => {
  it("Trivy payload の vulnerabilities を View へ写像し、NVD リンクを導出する", () => {
    const findings = securityFindingsFromPayload({
      vulnerabilities: [
        {
          cveId: "CVE-2021-3807",
          severity: "CRITICAL",
          package: "ansi-regex",
          version: "3.0.0",
          fixedVersion: "5.0.1",
        },
        {
          cveId: "CVE-2022-25883",
          severity: "HIGH",
          package: "semver",
          version: "7.3.4",
          fixedVersion: "7.5.2",
        },
      ],
    });

    expect(findings).toEqual([
      {
        cveId: "CVE-2021-3807",
        severity: "CRITICAL",
        package: "ansi-regex",
        version: "3.0.0",
        fixedVersion: "5.0.1",
        nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2021-3807",
      },
      {
        cveId: "CVE-2022-25883",
        severity: "HIGH",
        package: "semver",
        version: "7.3.4",
        fixedVersion: "7.5.2",
        nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2022-25883",
      },
    ]);
  });

  it("正規形でない cveId は捨てる（404 リンクを作らない）", () => {
    const findings = securityFindingsFromPayload({
      vulnerabilities: [
        { cveId: "GHSA-93q8-gq69-wqmw", severity: "HIGH", package: "x", version: "1" },
        { cveId: "CVE-2021-3807", severity: "HIGH", package: "y", version: "1" },
      ],
    });
    expect(findings.map((f) => f.cveId)).toEqual(["CVE-2021-3807"]);
  });

  it("小文字の cve id は正規形（大文字）へ寄せる", () => {
    const findings = securityFindingsFromPayload({
      vulnerabilities: [
        { cveId: "cve-2021-3807", severity: "critical", package: "p", version: "1" },
      ],
    });
    expect(findings[0].cveId).toBe("CVE-2021-3807");
    expect(findings[0].severity).toBe("CRITICAL");
    expect(findings[0].nvdUrl).toBe(
      "https://nvd.nist.gov/vuln/detail/CVE-2021-3807",
    );
  });

  it("fixedVersion 欠落は null、severity/package 欠落はフォールバックで補う", () => {
    const findings = securityFindingsFromPayload({
      vulnerabilities: [{ cveId: "CVE-2021-3807" }],
    });
    expect(findings[0]).toMatchObject({
      severity: "UNKNOWN",
      package: "unknown",
      version: "—",
      fixedVersion: null,
    });
  });

  it("vulnerabilities を持たない payload・壊れた要素は空/除外（防御的パース）", () => {
    expect(securityFindingsFromPayload({})).toEqual([]);
    expect(securityFindingsFromPayload({ vulnerabilities: "broken" })).toEqual([]);
    expect(
      securityFindingsFromPayload({ vulnerabilities: [null, 42, { cveId: 1 }] }),
    ).toEqual([]);
  });
});
