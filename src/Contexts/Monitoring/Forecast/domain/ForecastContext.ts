import { ForecastSignal } from "./ForecastSignal.js";

// ForecastPort.forecast への入力（Handler が組み立てる read-only スナップショット）。
// signals は主シグナル（FUTURE_CHANGE/SCHEDULE）と記憶（MEMORY）を結合済みの全量＝
// LLM 突合の母集団であり、RiskItem.citations の実在照合（F5 引用検証）の照合先でもある。
export type ForecastContext = {
  readonly horizon: string; // 対象期間（例: "今週末"）
  readonly signals: ForecastSignal[];
};
