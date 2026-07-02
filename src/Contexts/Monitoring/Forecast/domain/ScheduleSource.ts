import { ScheduleWindow } from "./Schedule.js";

// スケジュールの供給元（read-only）。最小実装は seed（JSON/config）。
export interface ScheduleSource {
  list(horizon: string): Promise<ScheduleWindow[]>;
}
