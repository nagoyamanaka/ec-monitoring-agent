/**
 * 発火したリスクの level 分布と「過去インシデントを引用したか」の判定（E6-3・純関数）。
 *
 * 偽陽性の床は「出さない」ではなく **「弱く出す」** の形をしている——裏付けが1種類しか無ければ
 * `GeminiForecastAdapter` のプロンプトが LOW〜MEDIUM に止める。したがって
 * 「**前例が無くても出る。ただし弱く出る**」を実測で言うには、level 分布を
 * **MEMORY 引用の有無で割った**数字が要る（→ 問答バンク A5-b の自己制限の解除）。
 *
 * ログ（`forecast_generated`）と集計（`ForecastMeasurement`）の両方がこの判定を使うので、
 * 「MEMORY を引用したとはどういうことか」の定義はここ1箇所に置く。
 */

import { ForecastSignal, ForecastSignalKind } from "./ForecastSignal.js";
import { RiskItem, RiskLevel } from "./RiskForecast.js";

export type RiskLevelCount = {
  readonly level: RiskLevel;
  readonly count: number;
  // うち過去インシデント（MEMORY シグナル）を引用したリスク数。
  // `count - withMemoryCitation` が「前例ゼロで出たリスク」＝ A5-b の主張の実測値。
  readonly withMemoryCitation: number;
};

// 分布は常に3段すべてを出す。0 の段を落とすと「HIGH が出ていない」と
// 「HIGH の列が存在しない」が同じ見え方になり、弱く出ていることを示せない。
export const RISK_LEVEL_ORDER: readonly RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];

/**
 * 引用が過去インシデントを指しているかは、**引用 id を同梱シグナルへ解決して kind を見る**。
 * id の綴り（`inc-*`）で判定しない——採番規則は `ForecastRiskUseCase` の実装詳細で、
 * 保存済みブリーフィングは解決先のシグナルを必ず同梱しているため照合できる。
 */
export function memorySignalIds(signals: readonly ForecastSignal[]): ReadonlySet<string> {
  return new Set(
    signals
      .filter((signal) => signal.kind === ForecastSignalKind.MEMORY)
      .map((signal) => signal.id),
  );
}

export function citesMemory(risk: RiskItem, memoryIds: ReadonlySet<string>): boolean {
  return risk.citations.some((id) => memoryIds.has(id));
}

export function countMemoryCitedRisks(
  risks: readonly RiskItem[],
  signals: readonly ForecastSignal[],
): number {
  const memoryIds = memorySignalIds(signals);
  return risks.filter((risk) => citesMemory(risk, memoryIds)).length;
}

export function countByLevel(
  risks: readonly RiskItem[],
  signals: readonly ForecastSignal[],
): RiskLevelCount[] {
  const memoryIds = memorySignalIds(signals);
  return RISK_LEVEL_ORDER.map((level) => {
    const atLevel = risks.filter((risk) => risk.level === level);
    return {
      level,
      count: atLevel.length,
      withMemoryCitation: atLevel.filter((risk) => citesMemory(risk, memoryIds)).length,
    };
  });
}

/** 構造化ログ1行に埋める形（`HIGH=1,MEDIUM=2,LOW=0`）。0 の段も落とさない。 */
export function formatLevels(risks: readonly RiskItem[]): string {
  return RISK_LEVEL_ORDER.map(
    (level) => `${level}=${risks.filter((risk) => risk.level === level).length}`,
  ).join(",");
}
