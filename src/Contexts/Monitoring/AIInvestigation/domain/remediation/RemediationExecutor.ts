import { RemediationInput } from "./RemediationInput.js";

/**
 * リメディエーションの実行結果。
 * - drafted   : その場で草案PRを起票できた（in-process / advisory 経路）
 * - dispatched : CI（GitHub Actions のAIエージェント）へ修正ジョブを投げ受け付けられた。
 *                実修正＋UT/E2E は CI 側で走り、結果は後で callback で確定する（PR URL はまだ無い）。
 * - failed    : 起票/ディスパッチに失敗（GitHub 未設定・API失敗等。reason に理由）
 */
export type RemediationOutcome =
  | { kind: "drafted"; pullRequestUrl: string }
  | { kind: "dispatched" }
  | { kind: "failed"; reason: string };

/**
 * 脆弱性一覧に対する修正の「実行」を担う driven ポート。
 * 同期起票（advisory）か CI への非同期ディスパッチ（agentic）かは実装が決める。
 * UseCase は outcome を RemediationRecord に写すだけで、どちらの戦略にも依存しない。
 */
export interface RemediationExecutor {
  execute(input: RemediationInput): Promise<RemediationOutcome>;
}
