import { eventTitle } from "./eventCatalog";

/**
 * パターン名（既知パターン ID / AI 推定パターン名）の表示専用人間語化（G4）。
 * 審査員・作業者が最初に読む「原因1行」に UPPER_SNAKE の機械語を出さないための写像で、
 * wire・保存値・突合キーは不変（E9 の riskSubjectLabel と同じ A3 型防御）。
 * 呼び出し側は label !== 原文 のとき原文を tooltip（title 属性）等のメタへ降格する。
 *
 * 写像の優先順:
 *   1. `類似既知: <eventName>` 形式（SimilarPatternRule が焼く）→ eventName 部を eventCatalog で写像
 *   2. 既知語彙の辞書（seed 既知パターン＋デモシナリオで実測した AI 推定名の全数）
 *   3. 未登録の UPPER_SNAKE_CASE → ハウススタイル（`_`→空白・小文字）。AI は新語を生成し得るため
 *      辞書に無くても snake_case の生 ID を主表示に残さない
 *   4. それ以外（既に人間語）→ 原文のまま（誤変換しない）
 */

/** SimilarPatternRule が生成する類似既知パターン名の接頭辞（値は eventName）。 */
const SIMILAR_PREFIX = "類似既知: ";

/**
 * 既知語彙 → 人間語。seed 既知パターン（KnownErrorPatternSeed）と、デモシナリオの実 AI 調査で
 * 観測した推定パターン名（step9 G4 実測）の全数列挙。ここに無い新語は下のハウススタイルが受ける。
 */
const PATTERN_LABELS: Record<string, string> = {
  // seed 既知パターン
  PAYMENT_TIMEOUT: "決済タイムアウト",
  INVENTORY_INSUFFICIENT: "在庫引当の不足",
  // デモシナリオの AI 推定名（実測）
  PAYMENT_PROVIDER_OUTAGE: "決済プロバイダ障害",
  DEPENDENCY_VULNERABILITY_DETECTED: "依存ライブラリの既知脆弱性",
  DB_CONNECTION_POOL_EXHAUSTION: "DB接続プールの枯渇",
  DB_CONNECTION_EXHAUSTION: "DB接続の枯渇",
  INFRA_CHANGE_INDUCED_DB_CONNECTION_EXHAUSTION:
    "インフラ変更起因のDB接続枯渇",
  MEMORY_EXHAUSTION: "メモリ枯渇",
};

const RAW_ID_PATTERN = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/;

export function patternLabel(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith(SIMILAR_PREFIX)) {
    const eventName = trimmed.slice(SIMILAR_PREFIX.length).trim();
    return SIMILAR_PREFIX + eventTitle(eventName);
  }
  if (PATTERN_LABELS[trimmed]) return PATTERN_LABELS[trimmed];
  if (RAW_ID_PATTERN.test(trimmed)) {
    return trimmed.replace(/_/g, " ").toLowerCase();
  }
  return name;
}

/**
 * 既知パターンの「何が原因か」1行（G4b）。既知の③行は patternName がタイトルの復唱に
 * なりがち（結晶化は定義上必ず・seed もこのデモ世界では同文）なので、パターン名でなく
 * 原因を出すための表示専用写像。
 *
 * 優先順:
 *   1. seed 既知パターンの要約辞書 — seed description は1文目がタイトルの言い換えで
 *      1行表示に向かないため、原因部分だけの要約（表示専用の凝縮・意味は seed と同一）
 *   2. wire の patternDescription — 結晶化パターンでは承認時の AI 調査 summary
 *      ＝その回に実際に確定した原因（捏造ゼロの実データ）
 *   3. どちらも無ければ undefined（呼び出し側は従来の「該当: パターン名」表示に劣化）
 */
const PATTERN_CAUSES: Record<string, string> = {
  // seed: "決済処理がタイムアウトしました。外部決済サービスへの接続に問題がある可能性があります。"
  PAYMENT_TIMEOUT: "外部決済サービスへの接続不良の可能性",
  // seed: "在庫不足により商品の予約に失敗しました。"
  INVENTORY_INSUFFICIENT: "在庫不足による商品引当の失敗",
  // seed 類似既知（ResolvedIncidentSeed）: 一致先は SimilarIncident で原因フィールドを
  // 持たないため、seed resolvedNote の一次切り分け「拒否理由が PROVIDER_UNAVAILABLE に
  // 集中する場合はプロバイダ障害」の凝縮を辞書で運ぶ。ライブ学習した事例への類似一致は
  // 辞書に無い＝従来表示（恒久対応は SimilarIncident への原因フィールド追加・backend）。
  "類似既知: ec.payment.declined":
    "決済プロバイダ側の障害の可能性（拒否が PROVIDER_UNAVAILABLE に集中）",
};

export function patternCause(
  patternName: string,
  patternDescription?: string,
): string | undefined {
  const dict = PATTERN_CAUSES[patternName.trim()];
  if (dict) return dict;
  const description = patternDescription?.trim();
  return description !== undefined && description !== ""
    ? description
    : undefined;
}
