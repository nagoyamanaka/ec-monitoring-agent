/**
 * 引用（citations / evidenceBundle）のソース種別グルーピング・純関数（タスク E8-D）。
 * 生ログ引用チップの羅列を「観測データ／変更履歴／過去事例」のレーンに畳み、
 * F8 の RiskCard 引用レーン（種別ごとの左ボーダー色）と同じ視覚言語をアラート側にも通す。
 * 種別は引用文字列の先頭プレフィックス（`appLogs:` 等）から決定的に導出する（LLM 非依存）。
 */

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
