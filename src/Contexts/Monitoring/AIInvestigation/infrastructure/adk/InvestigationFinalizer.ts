/** サブエージェント1回ぶんの出力（AgentTool の function response を文字列化したもの）。 */
export type SubAgentOutput = {
  /** 呼ばれたサブエージェント名（= AgentTool 名。例: root_cause_analyst）。 */
  readonly agent: string;
  /** そのサブエージェントが返した本文。 */
  readonly output: string;
};

/** 1回の調査セッションから回収した、清書に必要な材料一式。 */
export type InvestigationTranscript = {
  /** 調査の入力（seed プロンプト）。citableIds＝「引用してよい ID の全量」を含むので捏造の抑止に効く。 */
  readonly seedPrompt: string;
  /** サブエージェントの出力群（時系列）。コーディネーターが空応答でも、実質の調査結果はここに残る。 */
  readonly subAgentOutputs: readonly SubAgentOutput[];
  /** コーディネーターの最終テキスト。空文字＝fallback 第6原因（思考が出力予算を食い潰した）。 */
  readonly coordinatorFinalText: string;
};

/**
 * 調査セッションの結果を「固定スキーマの JSON 文字列」へ清書する後段（ADR-26 恒久策の finalizer 方式）。
 *
 * エージェント・グラフの**外**に置く直列ステップであることが本質。`responseSchema`（制約付きデコード）は
 * 関数呼び出しと併用できないためコーディネーターには付けられないが、ツールを持たない清書役になら付けられる。
 * こうして「熟考する仕事」と「JSON を書き出す仕事」を別ターンに分けると、思考トークンが出力予算を
 * 食い潰して空応答になる機序そのものが成立しなくなる（エージェント数は増えない）。
 *
 * 別 interface に切ってあるのは `InvestigationAgentRunner` と同じ理由——ランナーが LLM SDK に
 * 直接依存せず、縮退判断（`finalizeInvestigationOutput`）を fake 注入で UT できるようにするため。
 */
export interface InvestigationFinalizer {
  /** 清書済み JSON 文字列を返す。呼び出しに失敗した場合は例外（呼び元が下書きへ縮退する）。 */
  finalize(transcript: InvestigationTranscript): Promise<string>;
}
