import { ForecastBriefing } from "./ForecastBriefing.js";
import { ForecastId } from "./ForecastId.js";
import { ForecastClass, classifyForecast } from "./forecastClass.js";
import { computeSignalFingerprint } from "./forecastFingerprint.js";
import { ForecastWindowPolicy } from "./ForecastWindowPolicy.js";
import { RiskLevel } from "./RiskForecast.js";

/**
 * 予報台帳（T0-1）。risk 1件の発火ごとに issued を1行**追記**し、あとから復元できない情報
 * （その時点の予報器の版・窓長・原因シグナルの指紋）を発行の瞬間に固定する。
 *
 * 追記専用: 行を書き換えない。決着（T1-1）は resolution イベントを別行で追記し、
 * 予報の現在状態は forecastId ごとのイベント列から導出する（outcome をこの行に持たせない）。
 * リポジトリには append と読み取りしか無い＝update/delete は型の上で書けない。
 */
export const ForecastAssignment = {
  NORMAL: "normal", // 対照割付（T0-4）までは全件 normal・確率 1.0
} as const;

export type ForecastAssignment = (typeof ForecastAssignment)[keyof typeof ForecastAssignment];

export type ForecastIssued = {
  readonly eventType: "issued";
  readonly forecastId: string; // risk 1件ごとに新規採番（ForecastId）
  readonly briefingId: string; // 元の生成1回（RiskForecast.forecastId）。同じ回の risk を束ねる
  readonly protocolVersion: string; // 事前登録（T0-5）のタグ or SHA
  readonly forecasterVersion: string;
  readonly subjectKey: string; // RiskItem.subject をそのまま（正規化は突合側・T0-7）
  readonly class: ForecastClass;
  readonly level: RiskLevel;
  readonly issuedAt: Date; // UTC
  readonly windowLengthHours: number;
  readonly windowEndsAt: Date; // UTC
  readonly windowPolicyVersion: string;
  readonly evidenceSnapshotId: string; // T0-2 までは空文字
  readonly signalFingerprint: string;
  readonly assignment: ForecastAssignment;
  readonly assignmentProb: number;
};

// 決着（resolution）は T1-1 でこの union に足す。
export type ForecastLedgerEvent = ForecastIssued;

export interface ForecastLedgerRepository {
  /** 1行追記する。同じ forecastId の issued が既にあれば失敗する（二重発行しない）。 */
  append(event: ForecastLedgerEvent): Promise<void>;
  /** 全行（issuedAt 昇順）。 */
  findAll(): Promise<ForecastLedgerEvent[]>;
}

// 起動時に確定する、全行に共通の刻印。
export type ForecastLedgerStamp = {
  readonly protocolVersion: string;
  readonly forecasterVersion: string;
  readonly windowPolicy: ForecastWindowPolicy;
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * 引用検証を通った予報1回ぶんを、risk ごとの issued 行に展開する（純関数・採番のみ非決定）。
 * risk が0件（空予報・fallback）なら行も0件＝発火していないものは台帳に載せない。
 */
export function issueForecasts(
  briefing: ForecastBriefing,
  stamp: ForecastLedgerStamp,
): ForecastIssued[] {
  const signalsById = new Map(briefing.signals.map((signal) => [signal.id, signal]));
  const issuedAt = briefing.forecast.generatedAt;
  return briefing.forecast.risks.map((risk) => {
    const cited = risk.citations.flatMap((id) => signalsById.get(id) ?? []);
    const forecastClass = classifyForecast(cited);
    const windowLengthHours = stamp.windowPolicy.windowLengthHours(forecastClass);
    return {
      eventType: "issued",
      forecastId: ForecastId.random().value,
      briefingId: briefing.forecast.forecastId,
      protocolVersion: stamp.protocolVersion,
      forecasterVersion: stamp.forecasterVersion,
      subjectKey: risk.subject,
      class: forecastClass,
      level: risk.level,
      issuedAt,
      windowLengthHours,
      windowEndsAt: new Date(issuedAt.getTime() + windowLengthHours * HOUR_MS),
      windowPolicyVersion: stamp.windowPolicy.version,
      evidenceSnapshotId: "",
      signalFingerprint: computeSignalFingerprint(cited),
      assignment: ForecastAssignment.NORMAL,
      assignmentProb: 1.0,
    };
  });
}
