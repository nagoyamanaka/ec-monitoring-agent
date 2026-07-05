/**
 * SECURITY 検知（CI の Trivy スキャン）が payload に運ぶ脆弱性一覧の表示用型と、
 * payload → View の防御的パース・純関数。
 *
 * CVE id は公的データベース（NVD）に実在する検証可能な識別子なので、証拠として
 * クリック可能な外部リンクに解決できる（合成デモでも CVE 自体は本物＝嘘にならない）。
 * payload は ingest 境界を通った外部入力のため、形が合う要素だけを拾う（壊れた要素は捨てる）。
 */

export type SecurityFindingView = {
  /** 正規形（CVE-YYYY-NNNN…）を満たす CVE 識別子。 */
  readonly cveId: string;
  /** スキャナが付けた深刻度（CRITICAL/HIGH/…）。表示バッジ用に大文字化して持つ。 */
  readonly severity: string;
  readonly package: string;
  readonly version: string;
  /** 修正版（スキャナが提示しない場合は null）。 */
  readonly fixedVersion: string | null;
  /** NVD の脆弱性詳細ページ。cveId から決定論的に導出（常に実在リンク）。 */
  readonly nvdUrl: string;
};

/** CVE 識別子の正規形。これ(を満たすものだけ)を NVD リンクに解決する（404 リンクを作らない）。 */
const CVE_ID_PATTERN = /^CVE-\d{4}-\d{4,}$/i;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Alert の monitoringEvent.payload から脆弱性一覧を取り出す。
 * SECURITY 以外や vulnerabilities を持たない payload は空配列（呼び出し側の分岐を不要にする）。
 */
export function securityFindingsFromPayload(
  payload: Record<string, unknown>,
): SecurityFindingView[] {
  const vulnerabilities = payload["vulnerabilities"];
  if (!Array.isArray(vulnerabilities)) return [];

  return vulnerabilities.flatMap((v): SecurityFindingView[] => {
    if (typeof v !== "object" || v === null) return [];
    const record = v as Record<string, unknown>;
    const cveId = asString(record["cveId"]);
    if (cveId === null || !CVE_ID_PATTERN.test(cveId)) return [];
    return [
      {
        cveId: cveId.toUpperCase(),
        severity: (asString(record["severity"]) ?? "UNKNOWN").toUpperCase(),
        package: asString(record["package"]) ?? "unknown",
        version: asString(record["version"]) ?? "—",
        fixedVersion: asString(record["fixedVersion"]),
        nvdUrl: `https://nvd.nist.gov/vuln/detail/${cveId.toUpperCase()}`,
      },
    ];
  });
}
