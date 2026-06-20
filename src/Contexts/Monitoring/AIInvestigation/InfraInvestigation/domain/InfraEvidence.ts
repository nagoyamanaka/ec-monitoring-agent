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
