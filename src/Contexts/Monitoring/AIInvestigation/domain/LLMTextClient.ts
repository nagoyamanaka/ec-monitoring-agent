/**
 * LLMへの最小契約：systemInstruction と prompt を渡して生テキストを得るだけ。
 *
 * プロンプト整形・出力パース・ドメインマッピング・フォールバックといった調査
 * オーケストレーション（プロバイダ非依存）は LLMInvestigationAdapter が担う。
 * 本インターフェースの実装は「text in → text out」のプロバイダ固有呼び出しと、
 * その呼び出しの信頼性（リトライ／タイムアウト）にのみ責任を持つ。
 */
export interface LLMTextClient {
  /**
   * @throws 失敗時（タイムアウト／API エラー）はリトライ後に例外を送出する。
   *         呼び出し側（Service）が catch して fallback を生成する責務を持つ。
   */
  generate(systemInstruction: string, prompt: string): Promise<string>;
}
