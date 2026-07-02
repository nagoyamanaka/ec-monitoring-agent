import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResolvedAlertForecastMemoryRepository } from "./ResolvedAlertForecastMemoryRepository.js";
import { InMemoryAlertRepository } from "../../AlertAnalysis/infrastructure/persistence/InMemoryAlertRepository.js";
import { AlertRepository } from "../../AlertAnalysis/domain/AlertRepository.js";
import { Alert } from "../../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../AlertAnalysis/domain/AlertId.js";
import { InvestigationReport } from "../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../Shared/domain/MonitoringEventCategory.js";
import { ConsoleLogger } from "../../../Shared/infrastructure/logging/ConsoleLogger.js";

// AlertId は UUID 必須。テストでは末尾2桁だけ変えた固定 UUID を使う。
const uuid = (suffix: string) => `00000000-0000-4000-8000-0000000000${suffix}`;

const makeAlert = (params: {
  id: string;
  eventName?: string;
  status?: "OPEN" | "RESOLVED";
  withReport?: boolean;
  subject?: string;
  suggestedPatternName?: string;
  operatorNote?: string;
  feedbackCorrect?: boolean;
}): Alert => {
  const event = new MonitoringEvent({
    eventId: `evt-${params.id}`,
    eventName: params.eventName ?? "ec.db.connection_pool_exhausted",
    aggregateId: `agg-${params.id}`,
    occurredOn: new Date("2026-06-15T09:00:00.000Z"),
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.warning(),
    source: "ec-backend",
    payload: {},
  });

  let alert = Alert.createAsUnknown({ id: new AlertId(params.id), monitoringEvent: event });

  if (params.withReport !== false) {
    alert = alert.attachInvestigationReport(
      new InvestigationReport({
        summary: "プールサイズを引き上げて解消済み",
        confidence: 0.9,
        severity: AlertSeverity.warning(),
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName:
          params.suggestedPatternName ?? "DB_CONNECTION_POOL_EXHAUSTION",
        reviewStatus: ReviewStatus.approved(),
        investigatedAt: new Date("2026-06-15T09:20:00.000Z"),
        isFallback: false,
        subject: params.subject,
      }),
    );
  }

  return Alert.fromPrimitives({
    ...alert.toPrimitives(),
    status: params.status ?? "RESOLVED",
    feedback:
      params.feedbackCorrect || params.operatorNote
        ? { isCorrect: params.feedbackCorrect ?? true, operatorNote: params.operatorNote }
        : null,
  });
};

describe("ResolvedAlertForecastMemoryRepository", () => {
  let alertRepo: InMemoryAlertRepository;
  let logger: ConsoleLogger;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
  });

  const makeRepo = (source: AlertRepository = alertRepo) =>
    new ResolvedAlertForecastMemoryRepository(source, logger);

  it("解決済み（RESOLVED）かつレポート付きの Alert だけを投影する", async () => {
    await alertRepo.save(makeAlert({ id: uuid("a1"), status: "RESOLVED" }));
    await alertRepo.save(makeAlert({ id: uuid("a2"), status: "OPEN" })); // 現役は対象外
    await alertRepo.save(makeAlert({ id: uuid("a3"), status: "RESOLVED", withReport: false })); // レポート無しは対象外

    const repo = makeRepo();
    await repo.warmUp();

    const entries = await repo.findBySubjects(["db.connection_pool"]);
    expect(entries).toHaveLength(1);
    expect(entries[0].incidentId).toBe(uuid("a1"));
  });

  it("正解フィードバック済みなら OPEN でも投影する（承認済み＝解決事例）", async () => {
    await alertRepo.save(makeAlert({ id: uuid("a1"), status: "OPEN", feedbackCorrect: true }));

    const repo = makeRepo();
    await repo.warmUp();

    expect(await repo.findBySubjects(["db.connection_pool"])).toHaveLength(1);
  });

  it("report.subject があればそれを使い、無ければ suggestedPatternName から導出する", async () => {
    await alertRepo.save(makeAlert({ id: uuid("a1"), subject: "checkout" }));
    await alertRepo.save(makeAlert({ id: uuid("a2") })); // 旧データ相当＝導出フォールバック

    const repo = makeRepo();
    await repo.warmUp();

    const byExplicit = await repo.findBySubjects(["checkout"]);
    expect(byExplicit.map((e) => e.incidentId)).toEqual([uuid("a1")]);

    const byDerived = await repo.findBySubjects(["db_connection_pool_exhaustion"]);
    expect(byDerived.map((e) => e.incidentId)).toEqual([uuid("a2")]);
  });

  it("trigger は eventName、outcome はオペレーターのメモ優先（無ければ AI summary）", async () => {
    await alertRepo.save(makeAlert({ id: uuid("a1"), operatorNote: "プール上限を引き上げ" }));
    await alertRepo.save(makeAlert({ id: uuid("a2"), eventName: "ec.db.pool_exhausted_2" }));

    const repo = makeRepo();
    await repo.warmUp();

    const entries = await repo.findBySubjects(["db.connection_pool"]);
    const a1 = entries.find((e) => e.incidentId === uuid("a1"));
    const a2 = entries.find((e) => e.incidentId === uuid("a2"));
    expect(a1?.trigger).toBe("ec.db.connection_pool_exhausted");
    expect(a1?.outcome).toBe("プール上限を引き上げ");
    expect(a2?.outcome).toBe("プールサイズを引き上げて解消済み");
  });

  it("投影元の取得が失敗しても throw せず空で縮退する（起動を止めない）", async () => {
    const broken: AlertRepository = {
      save: async () => {},
      findById: async () => null,
      findByCriteria: async () => {
        throw new Error("mongo down");
      },
      findOpenByDedupKey: async () => null,
    };

    const repo = makeRepo(broken);
    await expect(repo.warmUp()).resolves.toBeUndefined();
    expect(await repo.findBySubjects(["db.connection_pool"])).toHaveLength(0);
  });
});
