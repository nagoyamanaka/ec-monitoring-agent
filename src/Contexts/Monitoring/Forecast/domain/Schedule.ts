// 業務/負荷スケジュールの1枠（例: 週末セールの checkout 負荷増）。
export type ScheduleWindow = {
  readonly subject: string; // 例: "checkout"
  readonly when: string; // 例: "Sat 20:00-23:00"
  readonly load: string; // 例: "x5 (セール)"
};
