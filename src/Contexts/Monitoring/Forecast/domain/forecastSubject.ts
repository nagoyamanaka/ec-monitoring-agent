// Forecast 突合キー subject の導出と照合。
// 導出は調査時（InvestigateAlertUseCase が report.subject に埋める）と投影時
// （ForecastMemory warmUp の旧データ・フォールバック）で同じ規約を使い、
// 照合（findBySubjects）も同じトークン化に載せる＝subject の語彙規約をこのファイルに閉じる。

// 小文字化し非英数字を "_" に潰す（例: "DB_CONNECTION_POOL" → "db_connection_pool"）。
export function normalizeSubject(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// 優先順: terraform リソース（未来の pending plan 側 subject と同じ語彙になる）
// → suggestedPatternName → category。LLM 出力ではなく deterministic に導出する。
export function deriveForecastSubject(params: {
  suggestedPatternName: string;
  category: string;
  terraformResources?: string[];
}): string {
  const resource = params.terraformResources?.[0];
  if (resource) return normalizeSubject(resource);
  if (params.suggestedPatternName.trim() !== "") {
    return normalizeSubject(params.suggestedPatternName);
  }
  return normalizeSubject(params.category);
}

// 表記ゆれ（"db.connection_pool" vs "db_connection_pool_exhaustion"）を吸収する照合。
// 共有トークン数 >= min(2, 短い方のトークン数)：多トークン同士は2語以上の共有、
// 単一トークン（"checkout" 等）はそのトークンの包含を要求＝1語だけの偶然一致を防ぐ。
export function subjectsMatch(a: string, b: string): boolean {
  const tokensA = subjectTokens(a);
  const tokensB = subjectTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  const required = Math.min(2, Math.min(tokensA.size, tokensB.size));
  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
    if (shared >= required) return true;
  }
  return false;
}

function subjectTokens(subject: string): Set<string> {
  return new Set(normalizeSubject(subject).split("_").filter((t) => t !== ""));
}
