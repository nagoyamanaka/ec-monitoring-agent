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
  // （plan-1=バックボーンVM縮小 / plan-2=Valkey 縮小 / sch-1=schedule seed /
  // inc-1..inc-4=ForecastMemory＝reset が seed した過去解決事例）への引用に、意図的な偽引用
  // ghost-* を混ぜてある:
  //  - risk[0]（flagship・backbone）: ghost-1 だけ落ち plan-1/sch-1/inc-1 が残る
  //  - risk[1]（Valkey カスケード・U2）: plan-2/sch-1/inc-3/inc-4 が残る（PR は stub 環境で
  //    未取得＝本番の実 draft PR で 4系統目が載る。stub では 3系統でも成立）
  //  - risk[2]: 裏付けゼロ（ghost-2 のみ）でリスクごと破棄される
  // ＝引用検証（ハルシネーション・ガード）を課金なしで決定論的に E2E 実演する。
  // inc-* を含めることで MEMORY seed が壊れた（記憶が引けない）場合は偽引用として落ちて E2E が赤くなる。
  // risks は adapter 側で level 降順→confidence 降順にソートされる（flagship 0.78 > valkey 0.72）。
  private static readonly FORECAST_CANNED_OUTPUT = JSON.stringify({
    risks: [
      {
        window: "土 20:00-23:00",
        subject: "db_connection_pool",
        level: "HIGH",
        confidence: 0.78,
        citations: ["plan-1", "sch-1", "inc-1", "ghost-1"],
        reasoning:
          "[STUB] バックボーンVM を 8→2GB に縮小する予定で Mongo の接続上限が細るところに、週末セールの checkout 負荷が重なって接続が急増し、過去も同じ経路で枯渇した実績がある。未来の変更・高負荷・過去の同型という独立した根拠がいずれも接続プール枯渇を指すため HIGH。",
        // F11a: 先手1行の wire 到達を決定論検証する（3件目は敢えて省略＝欠落縮退の経路も固定）。
        preventiveAction:
          "[STUB] VM を縮小する plan（plan-1）の適用を週末セール（土20:00-23:00）後へ延期することを推奨します。これにより同型の接続プール枯渇の再発を高負荷窓の外へ外せます。",
      },
      {
        window: "土 20:00-23:00",
        subject: "valkey_cache",
        level: "HIGH",
        confidence: 0.72,
        citations: ["plan-2", "sch-1", "inc-3", "inc-4"],
        reasoning:
          "[STUB] Valkey の maxmemory を縮小する予定でキャッシュのヒット率が下がると、週末セール負荷でキャッシュミスが DB を直撃し、過去も TTL短縮/メモリ縮小で同じ枯渇に至った実績がある。未来の変更・高負荷・過去の同型という独立した根拠がいずれも接続プール枯渇を指すため HIGH。",
        preventiveAction:
          "[STUB] Valkey を縮小する plan（plan-2）の適用とキャッシュ設定 PR のマージを週末セール（土20:00-23:00）後へ延期することを推奨します。これによりヒット率低下起因の接続プール枯渇の再発を高負荷窓の外へ外せます。",
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
