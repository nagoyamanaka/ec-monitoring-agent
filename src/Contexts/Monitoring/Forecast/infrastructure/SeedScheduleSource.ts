import { ScheduleWindow } from "../domain/Schedule.js";
import { ScheduleSource } from "../domain/ScheduleSource.js";

// スケジュールの seed 供給（read-only・最小実装＝固定リスト）。
// 実機ではカレンダー/リリース計画等の外部ソースに差し替える想定の受け皿。
export class SeedScheduleSource implements ScheduleSource {
  constructor(private readonly windows: ScheduleWindow[]) {}

  async list(_horizon: string): Promise<ScheduleWindow[]> {
    return this.windows;
  }
}
