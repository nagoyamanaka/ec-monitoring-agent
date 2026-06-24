import type { RemediationViewStatus } from "@monitoring/AIInvestigation/application/GetRemediation/RemediationResponse";

/**
 * リメディエーション（修正 PR 起票）結果の表示用型と、ワイヤ契約→View の純関数。
 * domain は型＋純関数のみ。status の単一ソースは backend（RemediationViewStatus）を type-only 再利用する。
 *
 * status の意味（backend RemediationRecord と整合）:
 * - none      : 未起票（record 無し）。remediable なら起票ボタンを活性にできる。
 * - dispatched: CI へ修正ジョブ投入済（実修正+UT は CI 側・結果は callback 確定）。SSE push が無いためポーリング対象。
 * - drafted   : PR 草案作成済（pullRequestUrl あり）。
 * - skipped   : 対象脆弱性なし（reason に理由）。
 * - failed    : GitHub 未設定・API 失敗等（reason に理由）。
 */
export type { RemediationViewStatus };

/** GET /alerts/:id/remediation の wire 形状（RemediationResponse を直に JSON 化したもの）。 */
export type RemediationResponseWire = {
  readonly alertId: string;
  readonly status: RemediationViewStatus;
  readonly pullRequestUrl: string | null;
  readonly vulnerabilityCount: number;
  readonly reason: string | null;
  readonly createdAt: string | null;
};

export type RemediationView = {
  readonly alertId: string;
  readonly status: RemediationViewStatus;
  readonly pullRequestUrl: string | null;
  readonly vulnerabilityCount: number;
  readonly reason: string | null;
  readonly createdAt: string | null;
};

export function toRemediationView(dto: RemediationResponseWire): RemediationView {
  return {
    alertId: dto.alertId,
    status: dto.status,
    pullRequestUrl: dto.pullRequestUrl,
    vulnerabilityCount: dto.vulnerabilityCount,
    reason: dto.reason,
    createdAt: dto.createdAt,
  };
}

/** 起票がまだか（起票ボタンを出してよいか）。 */
export function isRemediationUnstarted(view: RemediationView): boolean {
  return view.status === "none";
}

/**
 * CI の確定待ち（dispatched）か。true の間は GET /remediation をポーリングして
 * drafted/failed への確定を反映する（SSE push が無いため）。
 */
export function isRemediationPending(view: RemediationView): boolean {
  return view.status === "dispatched";
}

/** PR 草案が作成済みか（PR リンクを出せるか）。 */
export function hasPullRequest(view: RemediationView): boolean {
  return view.status === "drafted" && view.pullRequestUrl !== null;
}
