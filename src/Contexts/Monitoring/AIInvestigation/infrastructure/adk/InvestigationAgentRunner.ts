/**
 * ADK マルチエージェント・グラフ（Coordinator + 専門agent）への text-in / text-out 契約。
 *
 * seed プロンプト（調査コンテキストの JSON）を入力し、エージェント群が自律的に
 * 追加証拠を収集・分析した結果を「固定スキーマの JSON 文字列」で返す。
 *
 * これを別 interface に切ることで、ADKAgentInvestigationAdapter は ADK 依存を持たず
 * fake 注入でユニットテストできる（GeminiLLMClient と LLMInvestigationAdapter の関係と同型）。
 */
export interface InvestigationAgentRunner {
  /**
   * options.alertId が与えられた場合、実行イベント（ツール呼び出し）を当該 Alert に紐付けて
   * ライブ中継してよい（investigation-progress・実イベントのみ）。省略時は中継しない。
   */
  run(seedPrompt: string, options?: { alertId?: string }): Promise<string>;
}
