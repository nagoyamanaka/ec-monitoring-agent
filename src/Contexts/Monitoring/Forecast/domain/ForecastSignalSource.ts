import { ForecastSignal } from "./ForecastSignal.js";

// ★stretchⅡ→Ⅲ の継ぎ目（step4-1 §7.9）。主シグナル源を源非依存に抽象化し、
// ForecastRiskCommandHandler は Gateway を名指しせずこの配列を回すだけにする。
// 正規化（subject/when/desc 付与）は各実装の内側に閉じる＝源の追加が Handler ノータッチで済む。
// stretchⅡ 実装: PullRequestSignalSource / PendingPlanSignalSource / ScheduleSignalSource
// stretchⅢ 追加: EventLogPrecursorSource（kind=PRECURSOR）を1個足すだけ
export interface ForecastSignalSource {
  collect(horizon: string): Promise<ForecastSignal[]>; // read-only・正規化済みを返す
}
