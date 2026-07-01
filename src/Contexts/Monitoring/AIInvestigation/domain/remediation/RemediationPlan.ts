export type RemediationPlan = {
  readonly title: string;
  readonly branch: string;
  readonly fileChanges: Array<{ path: string; patch: string }>;
  readonly body: string;
  // 実依存の修正指示（package → 安全版）。gateway が base の package.json を読み、
  // pnpm.overrides にマージして本物の diff を作る。空/未指定なら方針 md のみ（従来動作）。
  readonly packageOverrides?: Readonly<Record<string, string>>;
};

export type RemediationResult =
  | { created: true; pullRequestUrl: string }
  | { created: false; reason: string };
