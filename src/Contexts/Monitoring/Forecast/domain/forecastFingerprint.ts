import { createHash } from "node:crypto";
import { ForecastSignal } from "./ForecastSignal.js";

/**
 * 予報器の版（T0-1）。予報の出し方を決める入力（モデル名・プロンプトテンプレート・閾値・
 * クラス定義・コード上の規則）の内容ハッシュ。どれか1文字でも変われば別の版になる＝計測期間中の凍結を台帳で検証できる。
 * 起動時に1度計算して使い回す（入力はすべて起動時に確定する）。
 */
export function computeForecasterVersion(params: {
  model: string;
  promptTemplate: string;
  thresholds: Readonly<Record<string, number>>;
  classDefinitions: unknown;
  pipelineRules: readonly string[];
}): string {
  // 配列に並べ直してから直列化する＝呼び出し側のキーの書き順で版が揺れない。
  return sha256(
    JSON.stringify([
      params.model,
      params.promptTemplate,
      params.thresholds,
      params.classDefinitions,
      params.pipelineRules,
    ]),
  );
}

/**
 * 発火の原因になったシグナル集合の指紋（T0-1）。同じ変更・同じスケジュールから出た予報を
 * 集計時に束ねるための鍵（重複除外そのものはここでしない）。
 * id（"chg-1" 等）は収集順で振られる連番で、同じシグナルでも回ごとに変わりうるので入れない。
 * 集合なので順序と重複は無視する。
 */
export function computeSignalFingerprint(signals: readonly ForecastSignal[]): string {
  const normalized = signals.map((signal) =>
    JSON.stringify([
      signal.kind,
      signal.subject,
      signal.when,
      signal.desc,
      signal.source,
      signal.url ?? null,
    ]),
  );
  return sha256(JSON.stringify([...new Set(normalized)].sort()));
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
