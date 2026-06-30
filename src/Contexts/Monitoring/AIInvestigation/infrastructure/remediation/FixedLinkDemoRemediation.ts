import {
  RemediationExecutor,
  RemediationOutcome,
} from "../../domain/remediation/RemediationExecutor.js";
import { RemediationInput } from "../../domain/remediation/RemediationInput.js";

/**
 * デモ/審査用の固定リンク経路。GitHub を一切叩かず、事前に1本だけ手動で起票しておいた
 * 本物の草案PRの URL を常に返す。
 * - 審査員が「修正を起票」を何度押しても新規PRは増えない（同じ1本を指すだけ）。
 * - 実行時に書き込みトークンを要求しないため、PAT 権限不足の 403 も起きない。
 * - URL 未設定なら failed（空リンクを drafted として見せないための安全弁）。
 * 実修正まで自動化する場合は GitHubActionsRemediationDispatcher / InProcessAdvisoryRemediation を使う。
 */
export class FixedLinkDemoRemediation implements RemediationExecutor {
  constructor(private readonly pullRequestUrl: string) {}

  async execute(_input: RemediationInput): Promise<RemediationOutcome> {
    if (!this.pullRequestUrl) {
      return {
        kind: "failed",
        reason:
          "REMEDIATION_DEMO_PR_URL が未設定のため、デモ用の修正PRリンクを返せません。",
      };
    }
    return { kind: "drafted", pullRequestUrl: this.pullRequestUrl };
  }
}
