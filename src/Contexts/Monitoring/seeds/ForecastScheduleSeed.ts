import { ScheduleWindow } from "../Forecast/domain/Schedule.js";

/**
 * 予兆ブリーフィングの業務/負荷スケジュール seed（F6・DEMO_ENABLED 配下で投入）。
 * §3.1 DB接続枯渇シナリオの「いつ負荷が来るか」を予報に与える。
 * 実機ではカレンダー/リリース計画から投影する想定のデモ値（F8 で本命 seed に調整する）。
 */
export const FORECAST_SCHEDULE_SEED: ScheduleWindow[] = [
  { subject: "checkout", when: "土 20:00-23:00", load: "x5（週末セール）" },
];
