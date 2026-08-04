import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecordRemediationResultUseCase } from "./RecordRemediationResultUseCase.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { RemediationRecord } from "../../domain/remediation/RemediationRecord.js";
import { RemediationRepository } from "../../domain/remediation/RemediationRepository.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";

function fakeNotifier(): SSEAlertNotifier {
  return {
    notify: vi.fn(),
    notifyRemediation: vi.fn(),
    notifyInvestigationProgress: vi.fn(),
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
  };
}

class FakeRemediationRepository implements RemediationRepository {
  readonly saved: RemediationRecord[] = [];
  async save(record: RemediationRecord): Promise<void> {
    this.saved.push(record);
  }
  async findByAlertId(alertId: string): Promise<RemediationRecord | null> {
    const matches = this.saved.filter((r) => r.alertId === alertId);
    return matches[matches.length - 1] ?? null;
  }
  async findStaleDispatched(): Promise<RemediationRecord[]> {
    return []; // 期限切れ走査はこの UseCase の関心外
  }
}

describe("RecordRemediationResultUseCase", () => {
  let repo: FakeRemediationRepository;
  let logger: ConsoleLogger;
  let notifier: SSEAlertNotifier;
  let useCase: RecordRemediationResultUseCase;

  beforeEach(() => {
    repo = new FakeRemediationRepository();
    logger = new ConsoleLogger();
    notifier = fakeNotifier();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new RecordRemediationResultUseCase(repo, notifier, logger);
  });

  it("dispatch 時に記録済みの vulnerabilityCount を保持して drafted に確定する", async () => {
    // dispatch 受付時に DraftRemediationUseCase が件数を記録済みの前提
    await repo.save({
      alertId: ALERT_ID,
      status: "dispatched",
      pullRequestUrl: null,
      vulnerabilityCount: 3,
      reason: null,
      createdAt: new Date(),
    });

    await useCase.run({
      alertId: ALERT_ID,
      status: "drafted",
      pullRequestUrl: "https://github.com/owner/repo/pull/9",
    });

    expect(repo.saved).toHaveLength(2);
    expect(repo.saved[1]).toMatchObject({
      alertId: ALERT_ID,
      status: "drafted",
      pullRequestUrl: "https://github.com/owner/repo/pull/9",
      vulnerabilityCount: 3, // CI は件数を知らないので既存値を引き継ぐ
      reason: null,
    });
  });

  it("先行レコードが無ければ vulnerabilityCount は 0 にフォールバックする", async () => {
    await useCase.run({
      alertId: ALERT_ID,
      status: "failed",
      reason: "UT failed after max attempts",
    });

    expect(repo.saved[0]).toMatchObject({
      status: "failed",
      pullRequestUrl: null,
      vulnerabilityCount: 0,
      reason: "UT failed after max attempts",
    });
  });

  it("pullRequestUrl / reason 未指定は null に正規化する", async () => {
    await useCase.run({ alertId: ALERT_ID, status: "drafted" });

    expect(repo.saved[0]).toMatchObject({
      status: "drafted",
      pullRequestUrl: null,
      reason: null,
    });
  });

  it("テストゲート緑だが変更ゼロなら skipped で確定する（失敗として記録しない）", async () => {
    await repo.save({
      alertId: ALERT_ID,
      status: "dispatched",
      pullRequestUrl: null,
      vulnerabilityCount: 2,
      reason: null,
      createdAt: new Date(),
    });

    await useCase.run({
      alertId: ALERT_ID,
      status: "skipped",
      reason: "修正すべき変更は残っていませんでした",
    });

    expect(repo.saved[1]).toMatchObject({
      status: "skipped",
      pullRequestUrl: null,
      vulnerabilityCount: 2,
      reason: "修正すべき変更は残っていませんでした",
    });
  });

  it("確定を SSE で push する（dispatched で待つ画面の即時反映）", async () => {
    await useCase.run({
      alertId: ALERT_ID,
      status: "drafted",
      pullRequestUrl: "https://github.com/owner/repo/pull/9",
    });

    expect(notifier.notifyRemediation).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: ALERT_ID,
        status: "drafted",
        pullRequestUrl: "https://github.com/owner/repo/pull/9",
      }),
    );
  });
});
