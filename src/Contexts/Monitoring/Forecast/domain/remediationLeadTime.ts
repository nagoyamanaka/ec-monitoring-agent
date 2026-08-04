/**
 * 有効リードタイム（E6-2・純関数）。
 *
 *   有効リードタイム = 予測発生時刻 − 予報発行時刻 − 対処の所要時間
 *
 * **これが負なら、その予報クラスは的中しても価値がない。** 精度の話をせずに予報の価値を
 * 語れる唯一の数字で、統計を必要としない（n=1 で成立する）＝的中率が二値で定義できない
 * 予報にとって、最初に出せる指標がこれになる。
 *
 * ## 2つの入力の性格が違う（混ぜないための注意）
 *
 * - **予報発行時刻**: `RiskForecast.generatedAt`＝実測
 * - **予測発生時刻**: `RiskItem.window` は LLM 由来の自由文字列（"土 20:00"）で機械的に引けない。
 *   **呼び出し側が渡す**——当面は人手の注記。`windowAt?: Date` への構造化は
 *   **予報が2桁に達してから**（LLM 出力のパースを増やす話で、n が1桁のうちは割に合わない）
 * - **対処の所要時間**: 下記の**宣言値**。実測ではない
 *
 * 「宣言値」と書くことが本質。実測を装わない。
 */

/**
 * 対処所要の宣言値（分）。
 *
 * 経路が同じなのでクラスで割らない——プール上限の引き上げも VM の machine_type 変更も
 * Valkey のメモリ変更も、**手順は「merge → 手動承認 → terraform apply」の1本**。
 * クラスごとに別々の数字を立てると、経路が同じものに根拠の無い差を作ることになる。
 */
export const DECLARED_REMEDIATION_MINUTES = 30;

export type EffectiveLeadTime = {
  /** 予報発行から予測発生までの猶予（分）。実測（generatedAt）と注記（predictedAt）の差。 */
  readonly leadMinutes: number;
  /** 対処の所要（分）。**宣言値**であって実測ではない。 */
  readonly remediationMinutes: number;
  /** 差し引き＝人が判断に使える時間（分）。**負を丸めない**（負に意味があるため）。 */
  readonly effectiveMinutes: number;
};

export function effectiveLeadTime(params: {
  /** 予報発行時刻（`RiskForecast.generatedAt`）。 */
  readonly issuedAt: Date;
  /** 予測発生時刻。`window` が文字列なので**呼び出し側の注記**として受け取る。 */
  readonly predictedAt: Date;
  /** 既定は宣言値。クラス別の値を持つようになったらここに渡す。 */
  readonly remediationMinutes?: number;
}): EffectiveLeadTime {
  const remediationMinutes = params.remediationMinutes ?? DECLARED_REMEDIATION_MINUTES;
  const leadMinutes = Math.round(
    (params.predictedAt.getTime() - params.issuedAt.getTime()) / 60_000,
  );
  return {
    leadMinutes,
    remediationMinutes,
    effectiveMinutes: leadMinutes - remediationMinutes,
  };
}

/**
 * 決裁の場（E7 の PR コメント）へ出す1行。**時間が届くのがこのフェーズの芯**なので、
 * level や確信度ではなく「あと何時間か・対処に何分かかるか」を先に言う。
 * 宣言値であることを必ず添える（実測と読ませない）。
 */
export function formatEffectiveLeadTime(lead: EffectiveLeadTime): string {
  const head = `予測発生まで ${formatDuration(lead.leadMinutes)}・対処の所要は約 ${lead.remediationMinutes} 分（宣言値）`;
  return lead.effectiveMinutes < 0
    ? `${head}＝ 対処が間に合わない見込み（${formatDuration(-lead.effectiveMinutes)}の不足）`
    : `${head}＝ 判断に使える時間は ${formatDuration(lead.effectiveMinutes)}`;
}

// 60分未満は分、それ以上は時間（30分以上は繰り上げず「約N時間」に丸めない＝
// 「約N時間M分」まで出す）。丸めで猶予を実際より長く見せない。
function formatDuration(minutes: number): string {
  if (minutes < 60) return `約 ${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `約 ${hours} 時間` : `約 ${hours} 時間 ${rest} 分`;
}
