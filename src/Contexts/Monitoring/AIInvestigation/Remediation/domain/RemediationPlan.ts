export type RemediationPlan = {
  readonly title: string;
  readonly branch: string;
  readonly fileChanges: Array<{ path: string; patch: string }>;
  readonly body: string;
};

export type RemediationResult =
  | { created: true; pullRequestUrl: string }
  | { created: false; reason: string };
