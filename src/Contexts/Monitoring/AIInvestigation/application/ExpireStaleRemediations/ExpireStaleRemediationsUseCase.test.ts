import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExpireStaleRemediationsUseCase } from "./ExpireStaleRemediationsUseCase.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { InMemoryRemediationRepository } from "../../infrastructure/remediation/InMemoryRemediationRepository.js";
import { RemediationRecord } from "../../domain/remediation/RemediationRecord.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";

const TIMEOUT_MS = 20 * 60 * 1000;
const NOW = new Date("2026-08-04T12:00:00.000Z");

function fakeNotifier(): SSEAlertNotifier {
  return {
    notify: vi.fn(),
    notifyRemediation: vi.fn(),
    notifyInvestigationProgress: vi.fn(),
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
  };
}

function dispatchedAt(createdAt: Date, alertId: string): RemediationRecord {
  return {
    alertId,
    status: "dispatched",
    pullRequestUrl: null,
    vulnerabilityCount: 3,
    reason: null,
    createdAt,
  };
}

describe("ExpireStaleRemediationsUseCase", () => {
  let repo: InMemoryRemediationRepository;
  let logger: ConsoleLogger;
  let notifier: SSEAlertNotifier;
  let useCase: ExpireStaleRemediationsUseCase;

  beforeEach(() => {
    repo = new InMemoryRemediationRepository();
    logger = new ConsoleLogger();
    notifier = fakeNotifier();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new ExpireStaleRemediationsUseCase(repo, notifier, logger, TIMEOUT_MS);
  });

  it("期限を過ぎた dispatched を理由つきで failed へ落とす", async () => {
    const old = new Date(NOW.getTime() - TIMEOUT_MS - 1000);
    await repo.save(dispatchedAt(old, "alert-old"));

    expect(await useCase.run(NOW)).toBe(1);

    const record = await repo.findByAlertId("alert-old");
    expect(record).toMatchObject({
      status: "failed",
      pullRequestUrl: null,
      vulnerabilityCount: 3, // dispatch 時の件数は保つ
    });
    expect(record?.reason).toContain("20 分");
  });

  it("期限内の dispatched は触らない（CI の結果を待っている最中）", async () => {
    const recent = new Date(NOW.getTime() - TIMEOUT_MS + 1000);
    await repo.save(dispatchedAt(recent, "alert-recent"));

    expect(await useCase.run(NOW)).toBe(0);

    expect(await repo.findByAlertId("alert-recent")).toMatchObject({
      status: "dispatched",
    });
    expect(notifier.notifyRemediation).not.toHaveBeenCalled();
  });

  it("dispatched 以外は古くても対象外（確定済みを蒸し返さない）", async () => {
    const old = new Date(NOW.getTime() - TIMEOUT_MS - 1000);
    await repo.save({
      ...dispatchedAt(old, "alert-drafted"),
      status: "drafted",
      pullRequestUrl: "https://github.com/owner/repo/pull/1",
    });

    expect(await useCase.run(NOW)).toBe(0);
    expect(await repo.findByAlertId("alert-drafted")).toMatchObject({
      status: "drafted",
    });
  });

  it("落とした確定を SSE で push する（dispatched で待つ画面の切り替え）", async () => {
    const old = new Date(NOW.getTime() - TIMEOUT_MS - 1000);
    await repo.save(dispatchedAt(old, "alert-old"));

    await useCase.run(NOW);

    expect(notifier.notifyRemediation).toHaveBeenCalledWith(
      expect.objectContaining({ alertId: "alert-old", status: "failed" }),
    );
  });

  it("2回目の走査では対象が残らない（冪等）", async () => {
    const old = new Date(NOW.getTime() - TIMEOUT_MS - 1000);
    await repo.save(dispatchedAt(old, "alert-old"));

    expect(await useCase.run(NOW)).toBe(1);
    expect(await useCase.run(NOW)).toBe(0);
  });
});
