import { describe, it, expect } from "vitest";
import { vulnerabilitiesFromPayload } from "./RemediationInput.js";

describe("vulnerabilitiesFromPayload", () => {
  it("vulnerabilities が配列でなければ空配列を返す", () => {
    expect(vulnerabilitiesFromPayload({})).toEqual([]);
    expect(vulnerabilitiesFromPayload({ vulnerabilities: null })).toEqual([]);
    expect(vulnerabilitiesFromPayload({ vulnerabilities: "x" })).toEqual([]);
    expect(vulnerabilitiesFromPayload({ vulnerabilities: 42 })).toEqual([]);
  });

  it("object 以外（null 含む）の要素は除外する", () => {
    const result = vulnerabilitiesFromPayload({
      vulnerabilities: [null, "str", 1, { cveId: "CVE-2024-AAAA" }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].cveId).toBe("CVE-2024-AAAA");
  });

  it("各フィールドを正規化して取り出す", () => {
    const result = vulnerabilitiesFromPayload({
      vulnerabilities: [
        {
          cveId: "CVE-2024-AAAA",
          severity: "HIGH",
          package: "axios",
          version: "1.6.0",
          fixedVersion: "1.7.4",
        },
      ],
    });

    expect(result[0]).toEqual({
      cveId: "CVE-2024-AAAA",
      severity: "HIGH",
      package: "axios",
      version: "1.6.0",
      fixedVersion: "1.7.4",
    });
  });

  it("cveId/severity は欠落・空文字なら既定値に、その他は null に落ちる", () => {
    const result = vulnerabilitiesFromPayload({
      vulnerabilities: [{ cveId: "", severity: 123, package: "" }],
    });

    expect(result[0]).toEqual({
      cveId: "unknown",
      severity: "UNKNOWN",
      package: null,
      version: null,
      fixedVersion: null,
    });
  });
});
