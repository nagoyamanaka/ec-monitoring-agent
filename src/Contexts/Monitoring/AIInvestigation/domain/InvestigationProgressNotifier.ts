import { InvestigationProgressPrimitives } from "./contracts/InvestigationProgressContract.js";

/**
 * AI 調査の進行イベントを外へ知らせる driven ポート。
 * ADK runner が実行イベント（ツール呼び出し／サブエージェント委譲）を観測するたびに呼ぶ。
 * 実装は SSE broadcast（SSEAlertNotifier が同名メソッドで構造的に満たす）＝
 * best-effort の通知であり、失敗しても調査本体を止めない。
 */
export interface InvestigationProgressNotifier {
  notifyInvestigationProgress(progress: InvestigationProgressPrimitives): void;
}
