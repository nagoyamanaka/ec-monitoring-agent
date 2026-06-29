import type {
  AppLogEntry,
  GitCommit,
  InfraEvidence,
  InfraMetric,
  TerraformDiff,
} from "../InfraEvidence.js";

export type AppLogEntryPrimitives = Omit<AppLogEntry, "timestamp"> & {
  readonly timestamp: string;
};

export type GitCommitPrimitives = Omit<GitCommit, "committedAt"> & {
  readonly committedAt: string;
};

export type InfraEvidencePrimitives = {
  readonly appLogs: AppLogEntryPrimitives[];
  readonly terraformDiff?: TerraformDiff;
  readonly recentCommits?: GitCommitPrimitives[];
  readonly metrics?: InfraMetric[];
  readonly collectedAt: string;
};

export function infraEvidenceToPrimitives(
  evidence: InfraEvidence,
): InfraEvidencePrimitives {
  return {
    appLogs: evidence.appLogs.map((log) => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    })),
    ...(evidence.terraformDiff ? { terraformDiff: evidence.terraformDiff } : {}),
    ...(evidence.recentCommits
      ? {
          recentCommits: evidence.recentCommits.map((commit) => ({
            ...commit,
            committedAt: commit.committedAt.toISOString(),
          })),
        }
      : {}),
    ...(evidence.metrics ? { metrics: evidence.metrics } : {}),
    collectedAt: evidence.collectedAt.toISOString(),
  };
}
