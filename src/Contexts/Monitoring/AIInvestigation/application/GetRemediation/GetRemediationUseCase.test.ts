import { describe, it, expect } from "vitest";
import { GetRemediationUseCase } from "./GetRemediationUseCase.js";
import { RemediationRecord } from "../../Remediation/domain/RemediationRecord.js";
import { RemediationRepository } from "../../Remediation/domain/RemediationRepository.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";

class FakeRemediationRepository implements RemediationRepository {
  private record: RemediationRecord | null = null;
  seed(record: RemediationRecord): void {
    this.record = record;
  }
  async save(record: RemediationRecord): Promise<void> {
    this.record = record;
  }
  async findByAlertId(): Promise<RemediationRecord | null> {
    return this.record;
  }
}

describe("GetRemediationUseCase", () => {
  it("未起票なら status='none' を返す", async () => {
    const useCase = new GetRemediationUseCase(new FakeRemediationRepository());

    const response = await useCase.run(ALERT_ID);

    expect(response.status).toBe("none");
    expect(response.pullRequestUrl).toBeNull();
    expect(response.createdAt).toBeNull();
    expect(response.vulnerabilityCount).toBe(0);
  });

  it("記録があれば状態・PR URL を返し createdAt を ISO 正規化する", async () => {
    const repo = new FakeRemediationRepository();
    repo.seed({
      alertId: ALERT_ID,
      status: "drafted",
      pullRequestUrl: "https://github.com/owner/repo/pull/7",
      vulnerabilityCount: 3,
      reason: null,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    });
    const useCase = new GetRemediationUseCase(repo);

    const response = await useCase.run(ALERT_ID);

    expect(response).toMatchObject({
      alertId: ALERT_ID,
      status: "drafted",
      pullRequestUrl: "https://github.com/owner/repo/pull/7",
      vulnerabilityCount: 3,
      createdAt: "2026-01-02T03:04:05.000Z",
    });
  });
});
