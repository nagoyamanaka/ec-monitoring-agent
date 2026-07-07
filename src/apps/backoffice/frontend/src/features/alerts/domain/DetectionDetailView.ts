/**
 * 検知ソース（Cloud Monitoring 等）が payload に運ぶ「発報の生情報」の表示用型と、
 * payload → View の防御的パース・純関数。
 *
 * eventName は dedup/分類キー（condition 名の slug）で「何が・どこで起きたか」を運べない。
 * その情報は ingest 境界（CloudMonitoringAlertTranslator）が payload に格納する
 * summary / documentation / 対象リソース等が担う＝ここはその表示射影。
 * payload は ingest 境界を通った外部入力のため、形が合うフィールドだけを拾う。
 */

export type DetectionDetailView = {
  /** 発報の要約（Cloud Monitoring の incident.summary）。 */
  readonly summary: string | null;
  /** ポリシーの documentation（label_extractors 展開済み＝検知ログの中身を含む）。改行を保持して表示する。 */
  readonly documentation: string | null;
  /** 発報したアラートポリシー名。 */
  readonly policyName: string | null;
  /** 発報対象リソース（例: ec-monitoring-backbone）。 */
  readonly resourceName: string | null;
  /** リソース種別（例: gce_instance）。 */
  readonly resourceType: string | null;
  /** しきい値系ポリシーの対象メトリクス（ログ一致系では null）。 */
  readonly metricType: string | null;
  /**
   * Cloud Monitoring インシデントのコンソール URL。実発報にしか存在しない
   * （合成注入は偽リンクを作らず載せない）＝実経路の証明として機能する。
   */
  readonly incidentUrl: string | null;
};

/** documentation の「ラベル: 値」1行分の表示射影。 */
export type DocumentationRow = {
  readonly label: string;
  readonly value: string;
};

/** 「Type labels {k=v,…}」形の resourceName を分解した表示射影。 */
export type ParsedResourceName = {
  /** リソース種別の人間語（例: "VM Instance"）。 */
  readonly descriptor: string;
  readonly labels: ReadonlyArray<{ readonly key: string; readonly value: string }>;
};

/**
 * Cloud Monitoring がログ一致ポリシーで自動生成する英文 summary
 * （"Log match condition with labels {…} fired for …"）かを判定する。
 * この形の summary はポリシー documentation（label_extractors 展開済み）と情報が全重複の
 * 機械文なので、呼び出し側は documentation がある場合リード文から原文表示へ降格してよい。
 */
export function isCloudMonitoringAutoSummary(summary: string): boolean {
  return /^Log match condition\b[\s\S]*\bfired for\b/.test(summary);
}

/**
 * documentation を「ラベル: 値」の行構成として定義リスト表示用にパースする。
 * 1行でも形が合わなければ null（呼び出し側は生テキスト表示へフォールバック）。
 * 値側の全角コロン（例: 「検知ログ: デモ用…を注入：意図的に…」）は最初の区切りだけで
 * 分割するため保持される。
 */
export function documentationRows(
  documentation: string,
): ReadonlyArray<DocumentationRow> | null {
  const lines = documentation
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length === 0) return null;
  const rows: DocumentationRow[] = [];
  for (const line of lines) {
    const matched = line.match(/^([^:：]{1,20})[:：]\s*(.+)$/);
    if (!matched) return null;
    rows.push({ label: matched[1].trim(), value: matched[2].trim() });
  }
  return rows;
}

/**
 * Cloud Monitoring が実発報で送る「VM Instance labels {instance_id=…, project_id=…, zone=…}」
 * 形の resource_name を種別＋ラベルへ分解する。形が違えば null（そのまま表示）。
 * 値に "," を含むケースは "=" を持たない断片を直前の値へ結合して守る。
 */
export function parseResourceName(
  resourceName: string,
): ParsedResourceName | null {
  const matched = resourceName.match(/^(.{1,40}?)\s+labels\s+\{([\s\S]+)\}\.?$/);
  if (!matched) return null;
  const labels: Array<{ key: string; value: string }> = [];
  for (const segment of matched[2].split(",")) {
    const eq = segment.indexOf("=");
    if (eq > 0) {
      labels.push({
        key: segment.slice(0, eq).trim(),
        value: segment.slice(eq + 1).trim(),
      });
    } else if (labels.length > 0) {
      const last = labels[labels.length - 1];
      last.value = `${last.value},${segment.trimEnd()}`;
    } else {
      return null;
    }
  }
  return labels.length > 0
    ? { descriptor: matched[1].trim(), labels }
    : null;
}

function asString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** リンクとして安全な https の URL のみ通す（外部入力を href に流すため）。 */
function asHttpsUrl(payload: Record<string, unknown>, key: string): string | null {
  const value = asString(payload, key);
  return value !== null && value.startsWith("https://") ? value : null;
}

/**
 * Alert の monitoringEvent.payload から発報の生情報を取り出す。
 * 該当フィールドを1つも持たない payload（EC 業務イベント等）は null（呼び出し側はセクション非表示）。
 */
export function detectionDetailFromPayload(
  payload: Record<string, unknown>,
): DetectionDetailView | null {
  const detail: DetectionDetailView = {
    summary: asString(payload, "summary"),
    documentation: asString(payload, "documentation"),
    policyName: asString(payload, "policyName"),
    resourceName: asString(payload, "resourceName"),
    resourceType: asString(payload, "resourceType"),
    metricType: asString(payload, "metricType"),
    incidentUrl: asHttpsUrl(payload, "url"),
  };
  const hasContent = Object.values(detail).some((v) => v !== null);
  return hasContent ? detail : null;
}
