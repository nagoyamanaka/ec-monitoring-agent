import { FunctionTool } from "@google/adk";
// ADK(@google/adk) は zod@4 に依存し FunctionTool は zod/v4 名前空間の ZodObject を期待する。
// 同一 zod コピーの zod/v4 から import して nominal 型を一致させる（root "zod" だと別宣言になり代入不可）。
import { z } from "zod/v4";
import { CloudLoggingGateway } from "../../infrainvestigation/CloudLoggingGateway.js";
import { TerraformGateway } from "../../infrainvestigation/TerraformGateway.js";
import { GitHubGateway } from "../../infrainvestigation/GitHubGateway.js";
import { SimilarIncidentRepository } from "../../../../SimilarIncident/domain/SimilarIncidentRepository.js";

/**
 * EvidenceCollectorAgent が使う「読み取り専用」ツール群（ADK FunctionTool）。
 * 既存の read-only Gateway / Repository をそのまま LLM ツールに薄くラップするだけ。
 *
 * - write 操作は一切持たせない（調査=read / リメディ=write の分離を越境させない）。
 * - 各ツールはベストエフォート: 失敗は throw せず { error } を返してエージェントの調査を継続させる
 *   （DefaultInfraInvestigationAdapter の try/catch と同方針）。
 * - 返り値は JSON シリアライズ可能な素のオブジェクトに正規化する（Date は ISO 文字列）。
 *
 * seed コンテキスト（InvestigateAlertUseCase が広く事前収集した証拠）と違い、ここでの収集は
 * エージェントが仮説に応じて引数（サービス名・時間窓・検索語）を絞って叩く「狙い撃ち」収集。
 */
export type InvestigationToolDeps = {
  readonly cloudLoggingGateway: CloudLoggingGateway;
  readonly terraformGateway: TerraformGateway;
  readonly githubGateway: GitHubGateway;
  readonly similarIncidentRepository: SimilarIncidentRepository;
};

function parseIso(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid ISO datetime: ${value}`);
  }
  return d;
}

async function bestEffort<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function buildInvestigationTools(deps: InvestigationToolDeps): FunctionTool[] {
  const fetchAppLogs = new FunctionTool({
    name: "fetch_app_logs",
    description:
      "Cloud Logging から指定サービスのアプリログ（ERROR/WARNING/INFO）を読み取り専用で取得する。障害発生時刻の前後を調べたいときに使う。",
    parameters: z.object({
      service: z.string().describe("対象サービス名（例: ec-backend）"),
      sinceIso: z
        .string()
        .describe("調査基点の時刻（ISO 8601）。通常は障害イベントの occurredOn を渡す"),
      windowMinutes: z
        .number()
        .optional()
        .describe("基点の前後何分を見るか（既定はゲートウェイ依存）"),
    }),
    execute: ({ service, sinceIso, windowMinutes }) =>
      bestEffort(async () => {
        const logs = await deps.cloudLoggingGateway.getAppLogs({
          service,
          occurredOn: parseIso(sinceIso),
          ...(windowMinutes !== undefined ? { windowMinutes } : {}),
        });
        return logs.map((l) => ({
          timestamp: l.timestamp.toISOString(),
          severity: l.severity,
          message: l.message,
          resource: l.resource,
        }));
      }),
  });

  const fetchTerraformDiff = new FunctionTool({
    name: "fetch_terraform_diff",
    description:
      "指定日時以降に適用済みの Terraform/IaC 差分を読み取り専用で取得する。どのリソースのどの属性が（before→after）変わったかが分かる。インフラ/設定変更が原因か疑うときに使う。",
    parameters: z.object({
      sinceIso: z.string().describe("この時刻以降の適用差分を見る（ISO 8601）"),
    }),
    execute: ({ sinceIso }) =>
      bestEffort(async () => {
        const diff = await deps.terraformGateway.getAppliedDiff({
          since: parseIso(sinceIso),
        });
        return (
          diff ?? {
            resourceChanges: [],
            changedResources: [],
            summary: "適用済みの差分なし",
          }
        );
      }),
  });

  const fetchRecentCommits = new FunctionTool({
    name: "fetch_recent_commits",
    description:
      "指定日時以降の直近コミットを読み取り専用で取得する。コード変更が原因か疑うときに使う。",
    parameters: z.object({
      sinceIso: z.string().describe("この時刻以降のコミットを見る（ISO 8601）"),
      limit: z.number().optional().describe("最大件数"),
    }),
    execute: ({ sinceIso, limit }) =>
      bestEffort(async () => {
        const commits = await deps.githubGateway.listRecentCommits({
          since: parseIso(sinceIso),
          ...(limit !== undefined ? { limit } : {}),
        });
        return commits.map((c) => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          committedAt: c.committedAt.toISOString(),
        }));
      }),
  });

  const searchSimilarIncidents = new FunctionTool({
    name: "search_similar_incidents",
    description:
      "過去の解決済みインシデントDBを類似度検索する（graded confidence）。今回の障害に似た事例と解決メモを引く。",
    parameters: z.object({
      eventName: z.string().describe("障害イベント名（厳密フィルタ/ブースト用）"),
      text: z.string().describe("自由文の検索語（症状・キーワード）"),
      limit: z.number().optional().describe("最大件数（既定5）"),
    }),
    execute: ({ eventName, text, limit }) =>
      bestEffort(async () => {
        const hits = await deps.similarIncidentRepository.search({
          eventName,
          text,
          limit: limit ?? 5,
        });
        return hits.map((h) => ({
          eventName: h.incident.eventName,
          occurredOn: h.incident.occurredOn.toISOString(),
          resolvedNote: h.incident.resolvedNote,
          score: h.score,
        }));
      }),
  });

  return [fetchAppLogs, fetchTerraformDiff, fetchRecentCommits, searchSimilarIncidents];
}
