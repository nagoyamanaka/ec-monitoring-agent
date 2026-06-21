import { LLMTextClient } from "../../domain/LLMTextClient.js";

/**
 * テスト／ローカルE2E 専用の LLMTextClient 実装。
 * GeminiLLMClient（本物のプロバイダ呼び出し）の差し替え先で、
 * 外部API・課金・非決定性を排した「固定の調査結果JSON」を返す。
 *
 * 本物の LLMInvestigationAdapter のオーケストレーション（プロンプト構築 → パース →
 * ドメインマッピング）はそのまま通るため、unknown 調査経路の配線を
 * Gemini に触れずに E2E 検証できる。命名の "Stub" が本番非用途であることを示す。
 */
export class StubLLMClient implements LLMTextClient {
  // LLMOutputParser のスキーマに一致する固定出力（isFallback=false で確定する）
  private static readonly CANNED_OUTPUT = JSON.stringify({
    summary: "[STUB] 決定論的なスタブ調査結果です（E2E用・課金なし）。",
    confidence: 0.9,
    severity: "WARNING",
    investigationSteps: [
      "[STUB] 直近のデプロイ差分を確認",
      "[STUB] 関連ログを照会",
    ],
    suggestedActions: ["[STUB] 一次対応を実施し、根本原因を継続調査する"],
    suggestedPatternName: "stub-investigated-pattern",
  });

  async generate(_systemInstruction: string, _prompt: string): Promise<string> {
    return StubLLMClient.CANNED_OUTPUT;
  }
}
