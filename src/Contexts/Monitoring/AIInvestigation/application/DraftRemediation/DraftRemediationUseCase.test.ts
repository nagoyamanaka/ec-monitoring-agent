import { describe, it, expect, vi, beforeEach } from "vitest";
import { DraftRemediationUseCase } from "./DraftRemediationUseCase.js";
import { InMemoryAlertRepository } from "../../../AlertAnalysis/infrastructure/persistence/InMemoryAlertRepository.js";
import { Alert } from "../../../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { MonitoringResourceNotFoundError } from "../../../AlertAnalysis/application/errors/MonitoringResourceNotFoundError.js";
import { RemediationExecutor } from "../../Remediation/domain/RemediationExecutor.js";
import {
  RemediationRecord,
} from "../../Remediation/domain/RemediationRecord.js";
import { RemediationRepository } from "../../Remediation/domain/RemediationRepository.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";

const VULNS = [
  { cveId: "CVE-2024-AAAA", severity: "HIGH", package: "axios", version: "1.6.0", fixedVersion: "1.7.4" },
  { cveId: "CVE-2024-BBBB", severity: "CRITICAL", package: "ws", version: "8.0.0", fixedVersion: "8.17.1" },
];

const makeAlert = (payload: Record<string, unknown>) =>
  Alert.createAsUnknown({
    id: new AlertId(ALERT_ID),
    monitoringEvent: new MonitoringEvent({
      eventId: "evt-001",
      eventName: "security.vulnerability_detected",
      aggregateId: "CVE-2024-BBBB",
      occurredOn: new Date("2026-01-01T00:00:00.000Z"),
      payload,
      category: MonitoringEventCategory.security(),
      severity: AlertSeverity.critical(),
      source: "trivy",
    }),
  });

class FakeRemediationRepository implements RemediationRepository {
  readonly saved: RemediationRecord[] = [];
  async save(record: RemediationRecord): Promise<void> {
    this.saved.push(record);
  }
  async findByAlertId(alertId: string): Promise<RemediationRecord | null> {
    const matches = this.saved.filter((r) => r.alertId === alertId);
    return matches[matches.length - 1] ?? null;
  }
}

describe("DraftRemediationUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let remediationRepo: FakeRemediationRepository;
  let logger: ConsoleLogger;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    remediationRepo = new FakeRemediationRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
  });

  it("アラートが存在しなければ MonitoringResourceNotFoundError を投げる", async () => {
    const executor: RemediationExecutor = { execute: vi.fn() };
    const useCase = new DraftRemediationUseCase(alertRepo, executor, remediationRepo, logger);

    await expect(useCase.run(new AlertId(ALERT_ID))).rejects.toBeInstanceOf(
      MonitoringResourceNotFoundError,
    );
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("脆弱性が無ければ実行せず skipped を記録する", async () => {
    await alertRepo.save(makeAlert({ foo: "bar" }));
    const executor: RemediationExecutor = { execute: vi.fn() };
    const useCase = new DraftRemediationUseCase(alertRepo, executor, remediationRepo, logger);

    await useCase.run(new AlertId(ALERT_ID));

    expect(executor.execute).not.toHaveBeenCalled();
    expect(remediationRepo.saved).toHaveLength(1);
    expect(remediationRepo.saved[0]).toMatchObject({
      status: "skipped",
      pullRequestUrl: null,
      vulnerabilityCount: 0,
    });
  });

  it("全脆弱性を executor に渡し、drafted なら PR URL を記録する", async () => {
    await alertRepo.save(makeAlert({ vulnerabilities: VULNS, repo: "owner/repo" }));
    const executor: RemediationExecutor = {
      execute: vi
        .fn()
        .mockResolvedValue({ kind: "drafted", pullRequestUrl: "https://github.com/owner/repo/pull/1" }),
    };
    const useCase = new DraftRemediationUseCase(alertRepo, executor, remediationRepo, logger);

    await useCase.run(new AlertId(ALERT_ID));

    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: ALERT_ID,
        repo: "owner/repo",
        vulnerabilities: expect.arrayContaining([
          expect.objectContaining({ cveId: "CVE-2024-BBBB", fixedVersion: "8.17.1" }),
        ]),
      }),
    );
    expect(remediationRepo.saved[0]).toMatchObject({
      status: "drafted",
      pullRequestUrl: "https://github.com/owner/repo/pull/1",
      vulnerabilityCount: 2,
      reason: null,
    });
  });

  it("dispatched なら受付として記録する（PR URL はまだ無い）", async () => {
    await alertRepo.save(makeAlert({ vulnerabilities: VULNS }));
    const executor: RemediationExecutor = {
      execute: vi.fn().mockResolvedValue({ kind: "dispatched" }),
    };
    const useCase = new DraftRemediationUseCase(alertRepo, executor, remediationRepo, logger);

    await useCase.run(new AlertId(ALERT_ID));

    expect(remediationRepo.saved[0]).toMatchObject({
      status: "dispatched",
      pullRequestUrl: null,
      vulnerabilityCount: 2,
      reason: null,
    });
  });

  it("failed は理由つきで記録する", async () => {
    await alertRepo.save(makeAlert({ vulnerabilities: VULNS }));
    const executor: RemediationExecutor = {
      execute: vi
        .fn()
        .mockResolvedValue({ kind: "failed", reason: "GITHUB_TOKEN is not configured" }),
    };
    const useCase = new DraftRemediationUseCase(alertRepo, executor, remediationRepo, logger);

    await useCase.run(new AlertId(ALERT_ID));

    expect(remediationRepo.saved[0]).toMatchObject({
      status: "failed",
      pullRequestUrl: null,
      vulnerabilityCount: 2,
      reason: "GITHUB_TOKEN is not configured",
    });
  });
});
