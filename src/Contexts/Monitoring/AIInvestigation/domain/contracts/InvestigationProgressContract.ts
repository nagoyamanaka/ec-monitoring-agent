/**
 * AI 調査の進行イベント（SSE 名前付きイベント "investigation-progress"）のワイヤ契約。
 * frontend / backend で共有する単一ソース（型のみ・ランタイム非依存）。
 *
 * ADK エージェント・グラフの実行イベント（どのエージェントがどのツール／サブエージェントを
 * 呼んだか）を、調査中の Alert に紐付けてライブ中継する（タスク E1(b)）。
 * **実イベントのみ**を運ぶ＝演出のための捏造イベントは存在しない。
 */
export type InvestigationProgressPrimitives = {
  /** 調査対象の Alert id（frontend はこれで ANALYZING 中のカード/ドロワーへ合流させる）。 */
  readonly alertId: string;
  /** イベントを発したエージェント名（ADK の author。例: evidence_collector / investigation_coordinator）。 */
  readonly agent: string;
  /**
   * 呼び出したツール名（例: fetch_commit_diff）。AgentTool によるサブエージェント委譲は
   * 委譲先エージェント名（例: impact_triage）がそのまま入る。
   */
  readonly tool: string;
  /** backend がイベントを観測した時刻（ISO 8601）。 */
  readonly at: string;
};
