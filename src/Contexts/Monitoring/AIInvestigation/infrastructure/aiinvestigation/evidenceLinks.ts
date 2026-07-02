import type { InfraEvidence } from "../../domain/InfraEvidence.js";
import type { InvestigationStepPrimitives } from "../../../AlertAnalysis/domain/contracts/AlertContract.js";

/**
 * 収集済み InfraEvidence から「どこを見ればよいか」の外部ディープリンクを **決定的に** 組み立てる。
 *
 * 方針: LLM に URL を作らせない（ハルシネーション URL は 404／誤誘導になり危険）。href は
 * 実際に収集した証拠の生フィールド（commit の sha・log の resource）＋環境設定（owner/repo・
 * GCP project）から機械的に導出する。設定が無ければそのソースのリンクは出さない（graceful）。
 */

export type EvidenceLinkConfig = {
  /**
   * GitHub の "owner/repo"。コミットリンクの基底。未設定ならコミットリンクを出さない。
   * 証拠収集ゲートウェイ（GitHubGatewayImpl）と同じ repo を指す必要があるため、環境変数は
   * そちらと同じ GITHUB_TARGET_REPO を正とする（別名 GITHUB_REPO を読んでいた過去は、
   * 実デプロイでは常に未設定＝コミットリンクが出ない不具合だった。evidenceLinkConfigFromEnv 参照）。
   */
  readonly githubRepo?: string;
  /** GCP プロジェクト ID（GCP_PROJECT_ID）。未設定なら Cloud Logging リンクを出さない。 */
  readonly gcpProjectId?: string;
};

function cloudLoggingUrl(resource: string, projectId: string): string {
  const query = `resource.labels.service_name="${resource}" severity>=ERROR`;
  return `https://console.cloud.google.com/logs/query;query=${encodeURIComponent(
    query,
  )}?project=${encodeURIComponent(projectId)}`;
}

export function buildEvidenceLinks(
  evidence: InfraEvidence | undefined,
  config: EvidenceLinkConfig,
): InvestigationStepPrimitives[] {
  if (!evidence) return [];

  const links: InvestigationStepPrimitives[] = [];

  // 直近コミット → GitHub の commit ページ（repo 設定時のみ）。
  if (config.githubRepo && evidence.recentCommits) {
    for (const commit of evidence.recentCommits) {
      links.push({
        text: `コミット ${commit.sha}: ${commit.message}`,
        href: `https://github.com/${config.githubRepo}/commit/${commit.sha}`,
        kind: "code",
      });
    }
  }

  // ERROR ログのリソース → Cloud Logging クエリ（project 設定時のみ・リソース単位で重複排除）。
  if (config.gcpProjectId) {
    const errorResources = [
      ...new Set(
        evidence.appLogs
          .filter((log) => log.severity === "ERROR")
          .map((log) => log.resource),
      ),
    ];
    for (const resource of errorResources) {
      links.push({
        text: `Cloud Logging: ${resource} の ERROR ログ`,
        href: cloudLoggingUrl(resource, config.gcpProjectId),
        kind: "log",
      });
    }
  }

  return links;
}

/**
 * 環境変数からデフォルトのリンク設定を読む（空文字は未設定として落とす）。
 * repo は証拠収集ゲートウェイ（config.github.targetRepo＝GITHUB_TARGET_REPO）と一致させる。
 * 旧名 GITHUB_REPO は後方互換のフォールバックとしてのみ残す。
 */
export function evidenceLinkConfigFromEnv(): EvidenceLinkConfig {
  return {
    githubRepo:
      process.env.GITHUB_TARGET_REPO || process.env.GITHUB_REPO || undefined,
    gcpProjectId: process.env.GCP_PROJECT_ID || undefined,
  };
}
