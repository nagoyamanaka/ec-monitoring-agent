import { FORECAST_PIPELINE_RULES } from "../../../../Contexts/Monitoring/Forecast/application/ForecastRisk/ForecastRiskUseCase.js";
import { FORECAST_CLASS_DEFINITIONS } from "../../../../Contexts/Monitoring/Forecast/domain/forecastClass.js";
import { computeForecasterVersion } from "../../../../Contexts/Monitoring/Forecast/domain/forecastFingerprint.js";
import {
  FORECAST_OUTPUT_RULES,
  FORECAST_SYSTEM_INSTRUCTION,
} from "../../../../Contexts/Monitoring/Forecast/infrastructure/GeminiForecastAdapter.js";
import { config } from "./config.js";

// 予報器として実際に使うモデル名。stub 時は "stub" にして本物の版と混ぜない。
export function forecastModelName(): string {
  return config.ai.useStubInvestigation ? "stub" : config.gemini.model;
}

/**
 * この起動（このチェックアウト＋env）の予報器の版（T0-1）。台帳への刻印（BackofficeApp）と
 * リプレイ CLI（T0-2）が同じ計算を使う＝「リプレイした版」と「記録した版」を同じ物差しで比べる。
 * 閾値は現状なし（level は LLM が付け、confidence のクランプは判定ではない）。
 */
export function currentForecasterVersion(): string {
  return computeForecasterVersion({
    model: forecastModelName(),
    promptTemplate: FORECAST_SYSTEM_INSTRUCTION,
    thresholds: {},
    classDefinitions: FORECAST_CLASS_DEFINITIONS,
    pipelineRules: [...FORECAST_PIPELINE_RULES, ...FORECAST_OUTPUT_RULES],
  });
}
