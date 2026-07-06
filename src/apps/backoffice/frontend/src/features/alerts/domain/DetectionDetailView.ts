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
