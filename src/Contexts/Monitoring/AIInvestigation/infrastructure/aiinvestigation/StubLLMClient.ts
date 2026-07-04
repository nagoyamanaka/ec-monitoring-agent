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
    // 表示用の人間語ラベル（本番 LLM も日本語の読めるパターン名を返す前提）。
    // 機械スラッグだと UI に "stub-investigated-pattern" がそのまま出てしまうため。
    suggestedPatternName: "[STUB] 未知の障害パターン（推定）",
    // remediate ボタン活性経路を E2E で通すため true 固定（advisory シグナルの配線確認）。
    remediable: true,
  });

  // GeminiForecastAdapter（予兆・F8）から呼ばれたときの固定予報。実在する seed シグナル
  // （plan-1=pending plan seed / sch-1=schedule seed / inc-1=ForecastMemory 先頭＝
  // reset が seed した過去解決事例）への引用に、意図的な偽引用 ghost-* を混ぜてある:
  // 1件目は ghost-1 だけが citations から落ち、2件目は裏付けゼロでリスクごと破棄される
  // ＝引用検証（ハルシネーション・ガード）を課金なしで決定論的に E2E 実演する。
  // inc-1 を含めることで stub モードの UI にも3系統（変更予定/負荷予定/記憶）の引用が揃い、
  // MEMORY seed が壊れた（記憶が引けない）場合は inc-1 が偽引用として落ちて E2E が赤くなる。
  private static readonly FORECAST_CANNED_OUTPUT = JSON.stringify({
    risks: [
      {
        window: "土 20:00-23:00",
        subject: "google_sql_database_instance_ec_db",
        level: "HIGH",
        confidence: 0.78,
        citations: ["plan-1", "sch-1", "inc-1", "ghost-1"],
        reasoning:
          "[STUB] 接続上限の縮小予定（未適用 plan）と週末セールの checkout 負荷・過去の同型枯渇が重なるため。",
        // F11a: 先手1行の wire 到達を決定論検証する（2件目は敢えて省略＝欠落縮退の経路も固定）。
        preventiveAction:
          "[STUB] 接続上限を縮小する plan（plan-1）の適用を週末セール後へ延期することを推奨します。",
      },
      {
        window: "今週末",
        subject: "uncited_claim",
        level: "MEDIUM",
        confidence: 0.4,
        citations: ["ghost-2"],
        reasoning: "[STUB] 裏付けシグナルなし（引用検証で破棄されるべきリスク）。",
      },
    ],
  });

  async generate(systemInstruction: string, _prompt: string): Promise<string> {
    // 予報かどうかは GeminiForecastAdapter の SYSTEM_INSTRUCTION 固有の語で判別する
    // （呼び出し元の識別子は LLMTextClient 契約に無いため、文言への相乗りで済ませる）。
    if (systemInstruction.includes("予兆ブリーフィング")) {
      return StubLLMClient.FORECAST_CANNED_OUTPUT;
    }
    return StubLLMClient.CANNED_OUTPUT;
  }
}
