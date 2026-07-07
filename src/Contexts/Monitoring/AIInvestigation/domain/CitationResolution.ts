/**
 * 引用の実在照合を「落とすか通すか」から「何に解決したか」へ昇格させる表示用射影（純関数）。
 *
 * J1（CitedEvidence.collectCitableEvidenceIds）は相関の捏造を落とす**ゲート**で、語彙を
 * 強い証拠（commit/terraform/metric）に絞る。本モジュールは**表示**が目的なので語彙を広げ、
 * 受信イベント名・既知パターンID・類似事例も含めた「収集済み証拠カタログ」と突合し、
 * 各引用が「どの出所のどのフィールドか」を決定論で復元する（LLM 非依存・新たな捏造面ゼロ）。
 * 解決しない引用は落とさず kind 未設定（未照合）のまま残す＝正直さの担保。
 * 両者は役割が違うため語彙を共有しない（ゲートは狭く・表示は広く）。
 */

import type {
  CitationRefPrimitives,
  CitationSourceKind,
} from "../../AlertAnalysis/domain/contracts/AlertContract.js";
import type { InfraEvidence } from "./InfraEvidence.js";

/** カタログ1エントリ＝照合キー（証拠カタログ上の id）とその出所種別・リンク。 */
export type CitationCatalogEntry = {
  readonly id: string;
  readonly kind: CitationSourceKind;
  readonly href?: string;
};

/** カタログ構築に必要な調査文脈の部分形（InvestigationContext の構造的サブセット）。 */
export type CitationCatalogContext = {
  readonly errorEvent: {
    readonly eventName: string;
    readonly payload?: Record<string, unknown>;
  };
  readonly knownPatterns?: ReadonlyArray<{ readonly name: string }>;
  readonly similarIncidents?: ReadonlyArray<{ readonly eventName: string }>;
  readonly infraEvidence?: InfraEvidence;
  readonly candidateAlerts?: ReadonlyArray<{ readonly alertId: string }>;
};

/**
 * payload 中の CVE 識別子（値全体が CVE-YYYY-NNNN… の文字列）。orderId 等の生データ UUID と違い、
 * CVE は NVD へ決定論リンクが組める検証可能IDなので、照合カタログに載せる唯一の payload 由来値
 * （確信度の verifiable_cve 強シグナル・SecurityFindingView の NVD リンクと同じ判断）。
 */
const CVE_ID_PATTERN = /^CVE-\d{4}-\d{4,}$/i;

/** payload 走査の深さ上限（vulnerabilities[] のネスト程度を想定・暴走防止）。 */
const MAX_PAYLOAD_SCAN_DEPTH = 4;

function collectCveIds(value: unknown, depth: number, out: Set<string>): void {
  if (depth > MAX_PAYLOAD_SCAN_DEPTH || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (CVE_ID_PATTERN.test(trimmed)) out.add(trimmed.toUpperCase());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectCveIds(item, depth + 1, out);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectCveIds(item, depth + 1, out);
  }
}

/**
 * 調査文脈から引用カタログを決定論で構築する。エントリは全て「システムが収集済みの事実」のみ
 * （受信イベント名／payload 中の CVE 識別子／既知パターン名／commit sha／terraform アドレス・
 * 由来 sha／メトリクス名／類似事例のイベント名／相関候補 alertId）。LLM の出力は一切入らない。
 */
export function buildCitationCatalog(
  context: CitationCatalogContext,
): CitationCatalogEntry[] {
  const entries: CitationCatalogEntry[] = [];
  const eventName = context.errorEvent.eventName.trim();
  if (eventName !== "") entries.push({ id: eventName, kind: "event" });
  // payload 由来は CVE 識別子のみ（検証可能ID・シナリオ4系）。NVD リンクは決定論で組む。
  const cveIds = new Set<string>();
  collectCveIds(context.errorEvent.payload, 0, cveIds);
  for (const cveId of cveIds) {
    entries.push({
      id: cveId,
      kind: "cve",
      href: `https://nvd.nist.gov/vuln/detail/${cveId}`,
    });
  }
  for (const pattern of context.knownPatterns ?? []) {
    if (pattern.name.trim() !== "") entries.push({ id: pattern.name, kind: "pattern" });
  }
  const evidence = context.infraEvidence;
  for (const commit of evidence?.recentCommits ?? []) {
    entries.push({ id: commit.sha, kind: "commit", ...(commit.url ? { href: commit.url } : {}) });
  }
  const diff = evidence?.terraformDiff;
  if (diff) {
    const href = diff.url ? { href: diff.url } : {};
    for (const address of new Set([
      ...diff.resourceChanges.map((c) => c.address),
      ...diff.changedResources,
    ])) {
      entries.push({ id: address, kind: "terraform", ...href });
    }
    if (diff.commitSha) entries.push({ id: diff.commitSha, kind: "terraform", ...href });
  }
  for (const metric of evidence?.metrics ?? []) {
    entries.push({ id: metric.metricType, kind: "metric" });
    if (metric.displayName.trim() !== "")
      entries.push({ id: metric.displayName, kind: "metric" });
  }
  // 類似事例は eventName しか安定キーが無い。調査対象イベント名と同値なら event が先勝ちする
  // （最長一致で同長は先着＝カタログ順。「今回の観測」の方が引用の意図として正確）。
  for (const incident of context.similarIncidents ?? []) {
    if (incident.eventName.trim() !== "")
      entries.push({ id: incident.eventName, kind: "incident" });
  }
  // 相関候補（同時期に開いている他アラート）。AI はこの id を影響評価の根拠に引くことがある
  // （例: 決済タイムアウト×DB枯渇）。リンクは backoffice SPA の内部ルート＝同一オリジンの
  // 相対パスのみを組む（外部 URL は組まない・フロントは相対 href を同タブ遷移で出す）。
  for (const candidate of context.candidateAlerts ?? []) {
    if (candidate.alertId.trim() !== "")
      entries.push({
        id: candidate.alertId,
        kind: "alert",
        href: `/alerts/${candidate.alertId}`,
      });
  }
  return entries;
}

/** 短い引用（省略 sha 等）を id 側包含で拾う際の下限長。これ未満は部分一致を許すと誤爆する。 */
const MIN_PARTIAL_CITATION_LENGTH = 7;

/**
 * 1引用をカタログと突合する。照合は case-insensitive の3段階（強い順に先勝ち）:
 * (1) 完全一致（引用がイベント名そのままなら、それを内包するパターン ID より優先する）
 * (2) 引用文字列が id を含む（guardRelatedAlerts / cited_commit と同じ流儀）。複数なら最長 id
 *     （例: 引用 "PROMOTED_EC.DB.X" はイベント名 "ec.db.x" も含むが、より特定的な
 *     パターン名に解決する）
 * (3) id が引用文字列を含む（省略 sha 対応・引用が7文字以上のときのみ）。複数なら最長 id
 */
function resolveOne(
  citation: string,
  catalog: readonly CitationCatalogEntry[],
): CitationRefPrimitives {
  const lower = citation.toLowerCase().trim();
  let exact: CitationCatalogEntry | undefined;
  let contains: CitationCatalogEntry | undefined;
  let containedBy: CitationCatalogEntry | undefined;
  for (const entry of catalog) {
    const id = entry.id.toLowerCase().trim();
    if (id === "") continue;
    if (id === lower) {
      exact ??= entry;
    } else if (lower.includes(id)) {
      if (!contains || id.length > contains.id.length) contains = entry;
    } else if (lower.length >= MIN_PARTIAL_CITATION_LENGTH && id.includes(lower)) {
      if (!containedBy || id.length > containedBy.id.length) containedBy = entry;
    }
  }
  const best = exact ?? contains ?? containedBy;
  if (!best) return { value: citation };
  return {
    value: citation,
    kind: best.kind,
    ...(best.href ? { href: best.href } : {}),
  };
}

/** citations 配列を順序・件数を保ったまま照合結果（1:1 対応）へ写像する。 */
export function resolveCitations(
  citations: readonly string[],
  catalog: readonly CitationCatalogEntry[],
): CitationRefPrimitives[] {
  return citations.map((citation) => resolveOne(citation, catalog));
}
