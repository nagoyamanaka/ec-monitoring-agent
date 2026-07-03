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
