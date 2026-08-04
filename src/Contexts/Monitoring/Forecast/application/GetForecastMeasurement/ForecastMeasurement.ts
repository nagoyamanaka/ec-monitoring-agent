/**
 * 予報の測定（E6-1 / E6-3）。保存済みの予報履歴を数えるだけの純関数——新規の推論はゼロ。
 *
 * **診断側（E2 の引用照合率）と数字を混ぜない。** 未照合引用の扱いが逆で、分母の意味が違う:
 *
 * |        | 未照合の引用 | 出せる指標 |
 * | ---    | ---          | ---        |
 * | 診断   | **残す**（分子から外し分母に置く） | 照合**率** |
 * | 予報   | **落とす**（表示前に破棄）         | 破棄**件数** |
 *
 * 予報側で率を出すと**定義上 100%** にしかならず、並べると診断側の率まで信用されなくなる。
 * したがってここが返すのは率ではなく件数だけで、表示も別ブロックに置く。
 */

import { ForecastBriefing } from "../../domain/ForecastBriefing.js";
import { ForecastSignalKind } from "../../domain/ForecastSignal.js";
import {
  countByLevel,
  RISK_LEVEL_ORDER,
  RiskLevelCount,
} from "../../domain/riskLevelBreakdown.js";

export type SignalKindCount = {
  readonly kind: ForecastSignalKind;
  readonly count: number;
};

export type ForecastMeasurement = {
  // 集計に入った予報の件数（＝下の全数字の母数）。除外は下の3つに分けて併記する。
  readonly forecasts: number;
  // --- 除外の内訳（0 を隠さないための3分割）---
  // 生成失敗の縮退。LLM 出力が無いので分母に入れると意味が壊れる。
  readonly excludedFallback: number;
  // シグナル0件＝ LLM を**呼んでいない**空予報。「呼んで何も落ちなかった」と同じ 0 に畳まない。
  readonly excludedNoSignals: number;
  // 検証カウンタが未保存（E6-1 以前に生成した予報）。「落とさなかった」ではなく「測っていない」。
  readonly excludedUnmeasured: number;
  // --- E6-1: 落とした側 ---
  readonly citationsEmitted: number;
  readonly citationsDropped: number;
  readonly risksEmitted: number;
  readonly risksDropped: number;
  // --- E6-3: 収集 → 発火の絞り込みと、発火の強さの分布 ---
  // 突合の母集団。⚠ 1リスクは複数シグナルを引くので **per-signal の発火率ではない**。
  // 「N 本を突合して M 本のリスクに絞った」＝入力→出力の件数として読む。
  readonly signalsCollected: number;
  readonly signalsByKind: readonly SignalKindCount[];
  readonly risksSurvived: number;
  // level 3段（0 の段も残す）と、各段のうち過去インシデントを引用したリスク数。
  readonly byLevel: readonly RiskLevelCount[];
};

const KIND_ORDER: readonly ForecastSignalKind[] = [
  ForecastSignalKind.FUTURE_CHANGE,
  ForecastSignalKind.SCHEDULE,
  ForecastSignalKind.MEMORY,
];

export function buildForecastMeasurement(
  briefings: readonly ForecastBriefing[],
): ForecastMeasurement {
  let forecasts = 0;
  let excludedFallback = 0;
  let excludedNoSignals = 0;
  let excludedUnmeasured = 0;
  let citationsEmitted = 0;
  let citationsDropped = 0;
  let risksEmitted = 0;
  let risksDropped = 0;
  let signalsCollected = 0;
  let risksSurvived = 0;
  const kindCounts = new Map<ForecastSignalKind, number>();
  const levelTotals = new Map<string, { count: number; withMemoryCitation: number }>();

  for (const { forecast, signals } of briefings) {
    // 除外は上から順に排他。fallback は「LLM が答えなかった」、シグナル0件は
    // 「LLM を呼ぶ材料が無かった」、未測定は「呼んだが会計を残していない」で、原因が別。
    if (forecast.isFallback) {
      excludedFallback += 1;
      continue;
    }
    if (signals.length === 0) {
      excludedNoSignals += 1;
      continue;
    }
    if (forecast.verification === undefined) {
      excludedUnmeasured += 1;
      continue;
    }

    forecasts += 1;
    citationsEmitted += forecast.verification.citationsEmitted;
    citationsDropped += forecast.verification.citationsDropped;
    risksEmitted += forecast.verification.risksEmitted;
    risksDropped += forecast.verification.risksDropped;
    signalsCollected += signals.length;
    risksSurvived += forecast.risks.length;

    for (const signal of signals) {
      kindCounts.set(signal.kind, (kindCounts.get(signal.kind) ?? 0) + 1);
    }
    for (const entry of countByLevel(forecast.risks, signals)) {
      const current = levelTotals.get(entry.level) ?? { count: 0, withMemoryCitation: 0 };
      levelTotals.set(entry.level, {
        count: current.count + entry.count,
        withMemoryCitation: current.withMemoryCitation + entry.withMemoryCitation,
      });
    }
  }

  // 種別は件数降順ではなく**定義順**で出す（回ごとに列が入れ替わると分布の変化が読めない）。
  const signalsByKind = KIND_ORDER.map((kind) => ({
    kind,
    count: kindCounts.get(kind) ?? 0,
  })).filter((entry) => entry.count > 0);

  // 3段すべてを出す（集計対象ゼロなら全段 0）。0 の段を落とすと
  // 「HIGH が出ていない」と「HIGH の列が無い」が同じ見え方になる。
  const byLevel = RISK_LEVEL_ORDER.map((level) => ({
    level,
    count: levelTotals.get(level)?.count ?? 0,
    withMemoryCitation: levelTotals.get(level)?.withMemoryCitation ?? 0,
  }));

  return {
    forecasts,
    excludedFallback,
    excludedNoSignals,
    excludedUnmeasured,
    citationsEmitted,
    citationsDropped,
    risksEmitted,
    risksDropped,
    signalsCollected,
    signalsByKind,
    risksSurvived,
    byLevel,
  };
}
