// security-scan(ingest) が MonitoringEvent.payload に同梱した脆弱性1件分。
// 検知境界（SecurityScanIngestPostController）が正規化した形をリメディ層が読む。
export type RemediationVulnerability = {
  readonly cveId: string;
  readonly severity: string;
  readonly package: string | null;
  readonly version: string | null;
  readonly fixedVersion: string | null;
};

// 修正PR草案の生成入力。1スキャンの HIGH/CRITICAL 全件をまとめて1 PR に直す。
export type RemediationInput = {
  readonly alertId: string;
  readonly repo: string | null;
  readonly vulnerabilities: RemediationVulnerability[];
};

// MonitoringEvent.payload（Record<string, unknown>）から脆弱性配列を防御的に抽出する。
// payload.vulnerabilities は外部CI起源で型保証がないため、ここで型を絞り正規化する。
export function vulnerabilitiesFromPayload(
  payload: Record<string, unknown>,
): RemediationVulnerability[] {
  const raw = payload["vulnerabilities"];
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      cveId: asStringOr(v["cveId"], "unknown"),
      severity: asStringOr(v["severity"], "UNKNOWN"),
      package: asStringOrNull(v["package"]),
      version: asStringOrNull(v["version"]),
      fixedVersion: asStringOrNull(v["fixedVersion"]),
    }));
}

function asStringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
