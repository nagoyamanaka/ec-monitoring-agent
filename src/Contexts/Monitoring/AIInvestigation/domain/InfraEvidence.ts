export type AppLogEntry = {
  readonly timestamp: Date;
  readonly severity: "ERROR" | "WARNING" | "INFO";
  readonly message: string;
  readonly resource: string;
};

export type TerraformDiff = {
  readonly changedResources: string[];
  readonly summary: string;
};

export type GitCommit = {
  readonly sha: string;
  readonly message: string;
  readonly author: string;
  readonly committedAt: Date;
};

export type InfraEvidence = {
  readonly appLogs: AppLogEntry[];
  readonly terraformDiff?: TerraformDiff;
  readonly recentCommits?: GitCommit[];
  readonly collectedAt: Date;
};

// ワイヤ契約（HTTP レスポンス）。Date は ISO 文字列に正規化する。
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
    collectedAt: evidence.collectedAt.toISOString(),
  };
}
