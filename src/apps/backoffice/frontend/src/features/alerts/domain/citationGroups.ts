/**
 * 引用（citations / evidenceBundle）のソース種別グルーピング・純関数（タスク E8-D）。
 * 生ログ引用チップの羅列を「観測データ／変更履歴／過去事例」のレーンに畳み、
 * F8 の RiskCard 引用レーン（種別ごとの左ボーダー色）と同じ視覚言語をアラート側にも通す。
 *
 * 種別の決定は2系統:
 * - refs あり（新データ）: backend が証拠カタログと実在照合した `CitationRefView.kind` を使う
 *   （groupCitationRefs）。何のパラメータかのラベル・照合結果・リンクまで出せる。
 * - refs なし（旧データ）: 引用文字列の先頭プレフィックス（`appLogs:` 等）から推測する
 *   （groupCitations・従来どおりのフォールバック）。
 */

import type { CitationRefView, CitationSourceKind } from "./InvestigationReportView";

export type CitationGroupKey = "observation" | "change" | "memory" | "other";

export type CitationGroup = {
  readonly key: CitationGroupKey;
  readonly label: string;
  /** レーンの左ボーダー色クラス（Tailwind）。 */
  readonly borderClass: string;
  readonly items: string[];
};

const GROUP_META: Record<
  CitationGroupKey,
  { label: string; borderClass: string }
> = {
  observation: { label: "観測データ", borderClass: "border-cyan-400/50" },
  change: { label: "変更履歴", borderClass: "border-amber-400/50" },
  memory: { label: "過去事例", borderClass: "border-emerald-400/50" },
  other: { label: "その他", borderClass: "border-slate-500/50" },
};

/** 表示順（語り順固定: 観測 → 変更 → 記憶 → その他）。 */
const GROUP_ORDER: readonly CitationGroupKey[] = [
  "observation",
  "change",
  "memory",
  "other",
];

const PREFIX_RULES: ReadonlyArray<[RegExp, CitationGroupKey]> = [
  [/^(appLogs|logs?|metrics|occurrenceCount)$/i, "observation"],
  [/^(terraform(Changes)?|commits?|diff|code|pr)$/i, "change"],
  [/^(inc(ident)?s?|similarIncidents?|similar)$/i, "memory"],
];

function classify(citation: string): CitationGroupKey {
  const prefix = citation.split(":", 1)[0]?.trim() ?? "";
  for (const [pattern, key] of PREFIX_RULES) {
    if (pattern.test(prefix)) return key;
  }
  return "other";
}

export function groupCitations(citations: readonly string[]): CitationGroup[] {
  const byKey = new Map<CitationGroupKey, string[]>();
  for (const citation of citations) {
    const key = classify(citation);
    const items = byKey.get(key);
    if (items) items.push(citation);
    else byKey.set(key, [citation]);
  }
  return GROUP_ORDER.filter((key) => byKey.has(key)).map((key) => ({
    key,
    label: GROUP_META[key].label,
    borderClass: GROUP_META[key].borderClass,
    items: byKey.get(key)!,
  }));
}

/**
 * 照合済み引用の「何のパラメータか」ラベル（引用値の隣に出す出所フィールド名）。
 * event はあえて「受信イベント名」＝ingest 境界の正典 ID であることを明示する
 * （検出層のカラム名を捏造しない・出所レイヤを正直にラベルする方針）。
 */
export const CITATION_KIND_LABEL: Record<CitationSourceKind, string> = {
  event: "受信イベント名",
  pattern: "既知パターンID",
  commit: "コミット",
  terraform: "Terraformリソース",
  metric: "メトリクス",
  incident: "類似事例",
  log: "アプリログ",
};

/** 照合済み kind → レーンの写像（プレフィックス推測に依らない決定論の系）。 */
const KIND_TO_GROUP: Record<CitationSourceKind, CitationGroupKey> = {
  event: "observation",
  metric: "observation",
  log: "observation",
  commit: "change",
  terraform: "change",
  pattern: "memory",
  incident: "memory",
};

export type CitationRefGroup = {
  readonly key: CitationGroupKey;
  readonly label: string;
  readonly borderClass: string;
  readonly items: CitationRefView[];
};

/** 実在照合済み引用のレーングルーピング。未照合（kind 無し）は「その他」に集める。 */
export function groupCitationRefs(refs: readonly CitationRefView[]): CitationRefGroup[] {
  const byKey = new Map<CitationGroupKey, CitationRefView[]>();
  for (const ref of refs) {
    const key = ref.kind ? KIND_TO_GROUP[ref.kind] : "other";
    const items = byKey.get(key);
    if (items) items.push(ref);
    else byKey.set(key, [ref]);
  }
  return GROUP_ORDER.filter((key) => byKey.has(key)).map((key) => ({
    key,
    label: GROUP_META[key].label,
    borderClass: GROUP_META[key].borderClass,
    items: byKey.get(key)!,
  }));
}

/** 照合済み件数（ヘッダの「✓ n/m 照合済み」表示用）。 */
export function countVerified(refs: readonly CitationRefView[]): number {
  return refs.filter((ref) => ref.kind !== undefined).length;
}
