import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";
import { FORECAST_CLASSES, ForecastClass } from "./forecastClass.js";

export const DEFAULT_WINDOW_LENGTH_HOURS = 72;

/**
 * クラス別の観測窓長（windowEndsAt = issuedAt + windowLengthHours）。
 * 窓長は決着（T1-1）の判定そのものを決めるので、どの窓の組で発行したかを version として台帳行に残す
 * ＝あとで窓長を変えても、旧窓で発行した行を旧窓のまま決着できる。
 */
export class ForecastWindowPolicy {
  readonly version: string;
  private readonly hoursByClass: Readonly<Record<ForecastClass, number>>;

  private constructor(hoursByClass: Record<ForecastClass, number>) {
    this.hoursByClass = hoursByClass;
    // クラス順は FORECAST_CLASSES で固定＝同じ窓長なら同じ文字列。行を見るだけで窓長の組が読める。
    this.version = JSON.stringify(hoursByClass);
  }

  // config の上書き（クラス名 → 時間）を既定 72h に重ねる。未知のクラス名・非正の値は起動時に落とす。
  static fromOverrides(overrides: Record<string, number>): ForecastWindowPolicy {
    const hoursByClass = Object.fromEntries(
      FORECAST_CLASSES.map((cls) => [cls, DEFAULT_WINDOW_LENGTH_HOURS]),
    ) as Record<ForecastClass, number>;
    for (const [name, hours] of Object.entries(overrides)) {
      if (!FORECAST_CLASSES.includes(name as ForecastClass)) {
        throw new InvalidArgumentError(`未知の予報クラスに窓長が指定されました: ${name}`);
      }
      if (!Number.isInteger(hours) || hours <= 0) {
        throw new InvalidArgumentError(`窓長は正の整数（時間）で指定してください: ${name}=${hours}`);
      }
      hoursByClass[name as ForecastClass] = hours;
    }
    return new ForecastWindowPolicy(hoursByClass);
  }

  windowLengthHours(forecastClass: ForecastClass): number {
    return this.hoursByClass[forecastClass];
  }
}
