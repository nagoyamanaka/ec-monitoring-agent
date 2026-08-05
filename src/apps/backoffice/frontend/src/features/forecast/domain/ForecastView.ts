import type {
  ForecastBriefingPrimitives,
  ForecastSignalPrimitives,
  RiskItemPrimitives,
} from "@monitoring/Forecast/domain/contracts/ForecastContract";
import {
  compareRiskDesc,
  normalizeRiskLevel,
  type RiskLevel,
} from "./RiskLevel";

/**
 * 予兆ブリーフィング（GET/POST /forecast）の表示射影（step6 F7）。型＋純関数のみ。
 * wire 契約は @monitoring の ForecastContract を単一ソースとして直接 import する。
 *
 * 引用（citations）は backend の2段検証（偽引用破棄・裏付けゼロのリスク破棄）を通過した
 * 実在 ForecastSignal.id のみが届く。ここでは同梱 signals から表示素材へ解決するだけだが、
 * 万一解決できない id は表示から落とす（防御・「盛らない側」）。
 */

/** シグナル種別 → 人間語ラベル。未知種別は生値をそのまま出す（degrade）。 */
const KIND_LABELS: Record<string, string> = {
  FUTURE_CHANGE: "未来の変更",
  SCHEDULE: "スケジュール",
  MEMORY: "過去の同型事例",
};

export function signalKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/**
 * risk.subject（突合キー＝terraform アドレス等の正規化生ID）の表示専用人間語化（E9）。
 * subject は plan address ↔ report.subject のペア語彙なので wire・保存値・突合は不変のまま、
 * 表示だけ既知語彙を人間語へ写像する。トークン包含で判定し、どのルールにも一致しなければ
 * 原文をそのまま返す（防御＝A3「生ID人間語化」と同じ方針）。生IDは呼び出し側で
 * tooltip 等のメタへ降格する（引用チップの <details> メタ行が突合キーの本文を担う）。
 */
const SUBJECT_LABEL_RULES: ReadonlyArray<{
  readonly tokens: readonly string[];
  readonly label: string;
}> = [
  // plan-1（module.gce_backbone.google_compute_instance.backbone）・過去事例の同 VM
  {
    tokens: ["google", "compute", "instance", "backbone"],
    label: "バックボーンVM（Mongo 同居・GCE）",
  },
  // plan-2（module.valkey_cache.google_redis_instance.catalog_cache）・Valkey 過去事例
  { tokens: ["valkey", "cache"], label: "カタログキャッシュ（Valkey）" },
  // stub 予報・過去事例（db_connection_pool 系）。checkout との複合語彙もこちらへ倒す
  { tokens: ["db", "connection", "pool"], label: "DB接続プール" },
  // schedule シグナル（checkout）
  { tokens: ["checkout"], label: "チェックアウト（購入導線）" },
];

export function riskSubjectLabel(subject: string): string {
  const tokens = new Set(
    subject
      .trim()
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t !== ""),
  );
  const rule = SUBJECT_LABEL_RULES.find((r) =>
    r.tokens.every((t) => tokens.has(t)),
  );
  return rule ? rule.label : subject;
}

/**
 * MEMORY シグナルの source は `incident.<実在AlertId>`（F5 の契約）。
 * 引用チップから当時のアラート詳細へ遷移できるよう alertId を取り出す。
 */
const INCIDENT_SOURCE_PREFIX = "incident.";

export function incidentAlertId(signal: {
  source: string;
}): string | undefined {
  return signal.source.startsWith(INCIDENT_SOURCE_PREFIX)
    ? signal.source.slice(INCIDENT_SOURCE_PREFIX.length)
    : undefined;
}

/** 引用チップ1枚の表示素材（実在シグナルへ解決済み）。 */
export type CitationView = {
  readonly id: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly subject: string;
  readonly when: string;
  readonly desc: string;
  /** 外部証拠への deep link（PR html_url 等）。 */
  readonly url?: string;
  /** MEMORY 引用の解決先アラート id（/alerts/:id へ遷移できる）。 */
  readonly alertId?: string;
};

export type RiskCardView = {
  readonly window: string;
  readonly subject: string;
  readonly level: RiskLevel;
  /** 0..1（backend でクランプ済みだが防御的に再クランプ）。 */
  readonly confidence: number;
  readonly reasoning: string;
  readonly citations: CitationView[];
  /** 発火自体を防ぐために人間が今打てる先手（F11a・無ければ先手行ごと非表示）。 */
  readonly preventiveAction?: string;
};

export type ForecastBriefingView = {
  readonly forecastId: string;
  readonly generatedAt: string;
  readonly horizon: string;
  readonly isFallback: boolean;
  /** level 降順 → confidence 降順。 */
  readonly risks: RiskCardView[];
  /** 評価に使ったシグナル総数（空予報の文脈表示用）。 */
  readonly signalCount: number;
  /** HIGH リスク件数（ナビバッジ「予兆: HIGH n件」用）。 */
  readonly highRiskCount: number;
};

/**
 * 引用を種別レーン（未来の変更 / スケジュール / 過去の同型事例）へグルーピングする。
 * 「単独では弱いシグナルが複数系統で重なるほどリスクが高い」という予報ロジックを
 * そのまま画面構造にする。
 * ⚠ **「タイムチャートは不採用」は 2026-08-05 に撤回した**（旧: window が LLM 由来の自由文字列で
 * 時刻を捏造せずには描けないため）。**引用している SCHEDULE シグナルから決定論で解決できる**
 * ようになったので却下の根拠が消えた（`ForecastTimeline`）。ただし読むのは引用シグナルの
 * `when`（＝我々のスケジュール定義）で、**`risk.window` は今も読まない**——収束レーンと
 * 時間軸は別々の材料から描いていて、どちらも LLM 文の解釈には依存していない。
 * レーン順は §3.1 の語り順（変更予定 → 負荷予定 → 記憶）に固定。未知種別は末尾。
 */
export type CitationLane = {
  readonly kind: string;
  readonly kindLabel: string;
  readonly citations: CitationView[];
};

const LANE_KIND_ORDER = ["FUTURE_CHANGE", "SCHEDULE", "MEMORY"];

function laneOrder(kind: string): number {
  const index = LANE_KIND_ORDER.indexOf(kind);
  return index === -1 ? LANE_KIND_ORDER.length : index;
}

export function groupCitationsByKind(
  citations: readonly CitationView[],
): CitationLane[] {
  const byKind = new Map<string, CitationView[]>();
  for (const citation of citations) {
    const lane = byKind.get(citation.kind) ?? [];
    lane.push(citation);
    byKind.set(citation.kind, lane);
  }
  return [...byKind.entries()]
    .sort(([a], [b]) => laneOrder(a) - laneOrder(b))
    .map(([kind, laneCitations]) => ({
      kind,
      kindLabel: signalKindLabel(kind),
      citations: laneCitations,
    }));
}

/** 根拠の系統数（収束の強さ）。RiskCard の「根拠 n系統」チップに使う。 */
export function citationKindCount(citations: readonly CitationView[]): number {
  return new Set(citations.map((c) => c.kind)).size;
}

/** 収束ミニフローの入力レーン1本（種別ラベル＋その系統の件数）。 */
export type ConvergenceLane = {
  readonly kind: string;
  readonly kindLabel: string;
  readonly count: number;
};

/**
 * 収束ミニフロー（U1③）の入力レーンを決定論で導出する。
 * 「どの系統が何件収束したか」を LLM 文ではなく引用の kind グルーピングから数える
 * ＝「なぜ HIGH か」を構造で見せる（groupCitationsByKind と同じレーン順）。
 */
export function convergenceLanes(
  citations: readonly CitationView[],
): ConvergenceLane[] {
  return groupCitationsByKind(citations).map((lane) => ({
    kind: lane.kind,
    kindLabel: lane.kindLabel,
    count: lane.citations.length,
  }));
}

/**
 * LLM 散文（reasoning / preventiveAction）を、引用 id の出現で分割する（E9 の続き）。
 *
 * 散文には「…インフラ変更（plan-1）と、関連する PR（pr-55）の適用を…」のように
 * **生の引用 id がそのまま埋まっている**。これはカード面に残った最後の機械語彙で、
 * 読者には内部ジャーゴンにしか見えない——が、**書き換えはしない**（LLM の出力は原文のまま。
 * 盛らない側の規律）。id を「下の引用カードへの参照」として描けるように分割だけする。
 * 分割対象は **このリスクの citations に実在する id だけ**——散文に現れても引用に無い id は
 * ただの文字列として残す（検証を通っていないものに参照の見た目を与えない）。
 */
export type ProseSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "citation"; readonly citation: CitationView };

export function segmentProseByCitations(
  text: string,
  citations: readonly CitationView[],
): ProseSegment[] {
  if (text === "") return [];
  const byId = new Map(citations.map((c) => [c.id, c]));
  if (byId.size === 0) return [{ kind: "text", text }];

  // 長い id から先に照合（pr-5 と pr-55 の前方一致誤爆を防ぐ）。前後が英数字/ハイフンで
  // 続く場合は別トークン（pr-550 の中の pr-55 を拾わない）。
  const ids = [...byId.keys()]
    .sort((a, b) => b.length - a.length)
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(
    `(?<![A-Za-z0-9-])(${ids.join("|")})(?![A-Za-z0-9-])`,
    "g",
  );

  const segments: ProseSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, index) });
    }
    segments.push({ kind: "citation", citation: byId.get(match[0])! });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }
  return segments;
}

/** シグナル種別 MEMORY（過去の同型事例）。 */
const MEMORY_KIND = "MEMORY";

/**
 * 引用に含まれる「過去の同型事例」の件数（先手の効果1行 U1③ の N に使う）。
 * 0 件なら効果行は出さない（盛らない側＝経路の根拠が無いのに再発型を語らない）。
 */
export function pastIncidentCount(
  citations: readonly CitationView[],
): number {
  return citations.filter((c) => c.kind === MEMORY_KIND).length;
}

function toCitationView(signal: ForecastSignalPrimitives): CitationView {
  return {
    id: signal.id,
    kind: signal.kind,
    kindLabel: signalKindLabel(signal.kind),
    subject: signal.subject,
    when: signal.when,
    desc: signal.desc,
    url: signal.url,
    alertId: incidentAlertId(signal),
  };
}

function toRiskCardView(
  risk: RiskItemPrimitives,
  signalById: ReadonlyMap<string, ForecastSignalPrimitives>,
): RiskCardView {
  const citations = risk.citations
    .map((id) => signalById.get(id))
    .filter((s): s is ForecastSignalPrimitives => s !== undefined)
    .map(toCitationView);
  return {
    window: risk.window,
    subject: risk.subject,
    level: normalizeRiskLevel(risk.level),
    confidence: Math.min(1, Math.max(0, risk.confidence)),
    reasoning: risk.reasoning,
    citations,
    ...(risk.preventiveAction ? { preventiveAction: risk.preventiveAction } : {}),
  };
}

/** wire（ForecastBriefingPrimitives）→ 表示射影。 */
export function toForecastBriefingView(
  dto: ForecastBriefingPrimitives,
): ForecastBriefingView {
  const signalById = new Map(dto.signals.map((s) => [s.id, s]));
  const risks = dto.forecast.risks
    .map((r) => toRiskCardView(r, signalById))
    .sort(compareRiskDesc);
  return {
    forecastId: dto.forecast.forecastId,
    generatedAt: dto.forecast.generatedAt,
    horizon: dto.forecast.horizon,
    isFallback: dto.forecast.isFallback,
    risks,
    signalCount: dto.signals.length,
    highRiskCount: risks.filter((r) => r.level === "HIGH").length,
  };
}
