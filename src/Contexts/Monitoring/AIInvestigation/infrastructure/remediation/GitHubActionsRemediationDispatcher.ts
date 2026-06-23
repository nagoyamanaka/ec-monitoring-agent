import {
  RemediationExecutor,
  RemediationOutcome,
} from "../../domain/remediation/RemediationExecutor.js";
import { RemediationInput } from "../../domain/remediation/RemediationInput.js";

/**
 * 修正をバックエンドでは行わず、GitHub Actions（repository_dispatch）へジョブを投げる agentic 経路。
 * CI ランナー側でブランチ作成→AIエージェント（Gemini CLI 等）が実コード修正→trivy 再スキャン＋
 * UT/E2E が緑になるまでループ→draft PR 起票、までを行う。本クラスは「発注」だけを担い、
 * 結果（PR URL / 成否）は CI からの callback（POST /ingest/remediation-result）で確定する。
 *
 * ＝ 修正の精度は「テストゲートのある実行環境」で担保する。API サーバ内で実コードを書き
 * テストを回すのは隔離・安全・リソースの面で破綻するため、実行をランナーへ押し出す設計。
 */
export class GitHubActionsRemediationDispatcher implements RemediationExecutor {
  constructor(
    private readonly token: string,
    private readonly repo: string,
    // ターゲットリポの workflow が購読する repository_dispatch のイベント種別。
    private readonly eventType: string = "ai-remediation",
    // AI自己修正ループの上限（課金暴走の安全弁）。CI 側ループがこの回数で打ち切る。
    private readonly maxAttempts: number = 2,
  ) {}

  async execute(input: RemediationInput): Promise<RemediationOutcome> {
    if (!this.token || !this.repo) {
      return {
        kind: "failed",
        reason: "GITHUB_TOKEN or remediation repo is not configured",
      };
    }

    try {
      await this.dispatch(input);
      return { kind: "dispatched" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      return { kind: "failed", reason };
    }
  }

  private async dispatch(input: RemediationInput): Promise<void> {
    // client_payload は dispatch 全体で 64KB 上限。HIGH/CRITICAL 件数は通常少ないが、
    // 念のため必要十分なフィールドだけに絞って送る（CI 側エージェントの修正入力）。
    const res = await fetch(`https://api.github.com/repos/${this.repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: this.eventType,
        client_payload: {
          alertId: input.alertId,
          repo: input.repo,
          vulnerabilities: input.vulnerabilities,
          // CI 側の自己修正ループはこの回数で打ち切る（上限は backend config が単一ソース）。
          maxAttempts: this.maxAttempts,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub dispatch ${res.status}: ${text}`);
    }
  }
}
