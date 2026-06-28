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

// Cloud Monitoring から相関取得した1メトリクスの要約（CPU / 接続数 / 5xx 等）。
// 生の時系列はそのまま AI に渡すとトークンを食うので、窓内の latest/max とサンプル点数に圧縮する。
// Date を含まないので Primitives は本型をそのまま再利用する。
export type InfraMetric = {
  readonly metricType: string;
  readonly displayName: string;
  readonly unit?: string;
  readonly latest: number | null;
  readonly max: number | null;
  readonly points: number;
};

export type InfraEvidence = {
  readonly appLogs: AppLogEntry[];
  readonly terraformDiff?: TerraformDiff;
  readonly recentCommits?: GitCommit[];
  readonly metrics?: InfraMetric[];
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
    // InfraMetric は Date を持たないのでそのまま透過。
    ...(evidence.metrics ? { metrics: evidence.metrics } : {}),
    collectedAt: evidence.collectedAt.toISOString(),
  };
}
