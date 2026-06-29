import { describe, it, expect } from "vitest";
import { SecurityScanTranslator } from "./SecurityScanTranslator.js";

const body = (overrides: Record<string, unknown> = {}) => ({
  cveId: "CVE-2024-0001",
  severity: "CRITICAL",
  package: "lodash",
  version: "4.17.20",
  fixedVersion: "4.17.21",
  repo: "example-org/ec-backend",
  scanner: "trivy",
  target: "repo:fs",
  vulnerabilities: [
    { cveId: "CVE-2024-0001", severity: "CRITICAL", package: "lodash" },
    { cveId: "CVE-2024-0002", severity: "HIGH", package: "axios" },
  ],
  ...overrides,
});

describe("SecurityScanTranslator", () => {
  it("CRITICAL は category=SECURITY / severity=critical / alertable で正規化する", () => {
    const event = SecurityScanTranslator.toMonitoringEvent(body());

    expect(event.eventName).toBe("security.vulnerability_detected");
    expect(event.category.value).toBe("SECURITY");
    expect(event.severity.value).toBe("CRITICAL");
    expect(event.isAlertable()).toBe(true);
    expect(event.aggregateId).toBe("CVE-2024-0001");
    expect(event.source).toBe("trivy");
  });

  it("HIGH は severity=warning で alertable", () => {
    const event = SecurityScanTranslator.toMonitoringEvent(body({ severity: "HIGH" }));
    expect(event.severity.value).toBe("WARNING");
    expect(event.isAlertable()).toBe(true);
  });

  it("MEDIUM/LOW/未指定は info ＝ 非 alertable（204 経路）", () => {
    for (const severity of ["MEDIUM", "LOW", undefined]) {
      const event = SecurityScanTranslator.toMonitoringEvent(body({ severity }));
      expect(event.severity.isInfo()).toBe(true);
      expect(event.isAlertable()).toBe(false);
    }
  });

  it("全脆弱性を payload に同梱し件数も載せる（後段の一括リメディ用）", () => {
    const event = SecurityScanTranslator.toMonitoringEvent(body());
    expect(event.payload.vulnerabilityCount).toBe(2);
    expect((event.payload.vulnerabilities as unknown[]).length).toBe(2);
    expect(event.payload.scanner).toBe("trivy");
  });

  it("欠損は安全側の既定で埋める（cveId=unknown / scanner=trivy）", () => {
    const event = SecurityScanTranslator.toMonitoringEvent({ severity: "CRITICAL" });
    expect(event.aggregateId).toBe("unknown");
    expect(event.source).toBe("trivy");
    expect(event.payload.vulnerabilityCount).toBe(0);
  });

  it("dedupKey は source(scanner)×category×eventName 粒度（CI 再実行/複数CVEを1件に畳む）", () => {
    const event = SecurityScanTranslator.toMonitoringEvent(body());
    expect(event.dedupKey()).toBe("trivy::SECURITY::security.vulnerability_detected");
  });
});
