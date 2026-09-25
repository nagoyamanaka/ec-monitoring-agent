import { ForecastSignal, ForecastSignalKind } from "./ForecastSignal.js";

/**
 * 予報のクラス（観測窓長・倍率を切る単位・T0-1）。
 * LLM の出力ではなく、**引用したシグナルの種類**から決定論的に導出する
 * （同じ引用集合なら常に同じクラス＝計測期間中にクラスの切り方が揺れない）。
 * 導出規則を変えたら FORECAST_CLASS_DEFINITIONS の rule も書き換える＝forecasterVersion が変わる。
 */
export const ForecastClass = {
  CHANGE_RISK: "change_risk", // 未来の変更（未マージPR / 未適用plan）を根拠に含む
  LOAD_RISK: "load_risk", // 変更は無く、負荷スケジュールを根拠に含む
  RECURRENCE_RISK: "recurrence_risk", // 過去インシデントの記憶だけが根拠
} as const;

export type ForecastClass = (typeof ForecastClass)[keyof typeof ForecastClass];

export const FORECAST_CLASSES: readonly ForecastClass[] = Object.values(ForecastClass);

// forecasterVersion のハッシュ入力（クラス定義ファイルの内容）。上から順に最初に当たったクラス。
export const FORECAST_CLASS_DEFINITIONS = [
  { class: ForecastClass.CHANGE_RISK, rule: "cited kinds include FUTURE_CHANGE" },
  { class: ForecastClass.LOAD_RISK, rule: "cited kinds include SCHEDULE" },
  { class: ForecastClass.RECURRENCE_RISK, rule: "otherwise (MEMORY only)" },
] as const;

export function classifyForecast(citedSignals: readonly ForecastSignal[]): ForecastClass {
  const kinds = new Set(citedSignals.map((signal) => signal.kind));
  if (kinds.has(ForecastSignalKind.FUTURE_CHANGE)) return ForecastClass.CHANGE_RISK;
  if (kinds.has(ForecastSignalKind.SCHEDULE)) return ForecastClass.LOAD_RISK;
  return ForecastClass.RECURRENCE_RISK;
}
