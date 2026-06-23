// 起票結果のライフサイクル。
// dispatched=CIへ修正ジョブ投入済（実修正+UTはCI側・結果は callback で確定）/
// drafted=PR草案作成済 / skipped=対象脆弱性なし / failed=GitHub未設定・API失敗等（理由を reason に保持）。
export type RemediationStatus = "dispatched" | "drafted" | "skipped" | "failed";

// アラート1件に対する直近のリメディエーション結果。GET /remediation の読み取り元。
export type RemediationRecord = {
  readonly alertId: string;
  readonly status: RemediationStatus;
  readonly pullRequestUrl: string | null;
  readonly vulnerabilityCount: number;
  readonly reason: string | null;
  readonly createdAt: Date;
};
