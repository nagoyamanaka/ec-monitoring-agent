import { describe, it, expect, beforeEach, vi } from "vitest";
import { RebuildSimilarIncidentsUseCase } from "./RebuildSimilarIncidentsUseCase.js";
import { SubmitFeedbackUseCase } from "../SubmitFeedback/SubmitFeedbackUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";
import { InMemorySimilarIncidentRepository } from "../../../SimilarIncident/infrastructure/InMemorySimilarIncidentRepository.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { ResolvedIncident } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { Filters } from "../../../../Shared/domain/criteria/Filters.js";
import { Order } from "../../../../Shared/domain/criteria/Order.js";
import { FixedThresholdPromotionPolicy } from "../../domain/promotion/FixedThresholdPromotionPolicy.js";

const ID_APPROVED_1 = "550e8400-e29b-41d4-a716-446655440001";
const ID_APPROVED_2 = "550e8400-e29b-41d4-a716-446655440002";
const ID_REJECTED = "550e8400-e29b-41d4-a716-446655440003";
const SEED_SOURCE_ID = "5eed0000-0000-4000-8000-000000000004";

const makeAlert = (id: string, eventName: string, reason: string) =>
  Alert.createAsUnknown({
    id: new AlertId(id),
    monitoringEvent: new MonitoringEvent({
      eventId: `evt-${id}`,
      eventName,
      aggregateId: "agg-1",
      occurredOn: new Date("2026-01-01T00:00:00.000Z"),
      payload: { reason },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.pending(),
      source: "unknown",
    }),
  });

const SEED: ResolvedIncident = {
  eventName: "ec.payment.declined",
  occurredOn: new Date("2026-06-10T13:00:00.000Z"),
  resolvedNote: "手で書いた seed のメモ",
  searchText: "provider unavailable; payment declined; provider failover",
  severity: AlertSeverity.warning(),
  sourceAlertId: SEED_SOURCE_ID,
};

describe("RebuildSimilarIncidentsUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let similarRepo: InMemorySimilarIncidentRepository;
  let logger: ConsoleLogger;

  beforeEach(async () => {
    alertRepo = new InMemoryAlertRepository();
    similarRepo = new InMemorySimilarIncidentRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);

    await alertRepo.save(makeAlert(ID_APPROVED_1, "ec.db.pool_exhausted", "POOL_FULL"));
    await alertRepo.save(makeAlert(ID_APPROVED_2, "ec.payment.declined", "PROVIDER_UNAVAILABLE"));
    await alertRepo.save(makeAlert(ID_REJECTED, "ec.inventory.mismatch", "STALE_CACHE"));
  });

  const findAll = () => similarRepo.findSimilar(new Criteria(Filters.none(), Order.none()));
  const bySource = async (sourceAlertId: string) =>
    (await findAll()).filter((i) => i.sourceAlertId === sourceAlertId);

  // 承認2・却下1 を実際の承認経路（SubmitFeedbackUseCase）で積む＝再構築の比較対象になる「承認時の形」
  const submitFeedback = async () => {
    const submit = new SubmitFeedbackUseCase(
      alertRepo,
      new InMemoryKnownErrorPatternRepository(),
      similarRepo,
      logger,
      new FixedThresholdPromotionPolicy(99),
    );
    await submit.run({ alertId: new AlertId(ID_APPROVED_1), isCorrect: true, operatorNote: "プール拡張で解決" });
    await submit.run({ alertId: new AlertId(ID_APPROVED_2), isCorrect: true });
    await submit.run({ alertId: new AlertId(ID_REJECTED), isCorrect: false, operatorNote: "誤検知" });
  };

  it("Alert 3件（承認2・却下1）→ ES に 2件。却下は入らない", async () => {
    await submitFeedback();
    await similarRepo.clear(); // ES のデータが飛んだ状態

    const result = await new RebuildSimilarIncidentsUseCase(alertRepo, similarRepo, logger).run();

    expect(result).toEqual({ rebuilt: 2, seeded: 0 });
    const all = await findAll();
    expect(all).toHaveLength(2);
    expect(all.map((i) => i.sourceAlertId).sort()).toEqual([ID_APPROVED_1, ID_APPROVED_2]);
    expect(await bySource(ID_REJECTED)).toHaveLength(0);
  });

  it("承認時に index された事例と同じ形に戻る（resolvedNote・searchText・severity）", async () => {
    await submitFeedback();
    const before = (await findAll()).map(({ id: _id, resolvedAt: _at, ...rest }) => rest);
    await similarRepo.clear();

    await new RebuildSimilarIncidentsUseCase(alertRepo, similarRepo, logger).run();

    const after = (await findAll()).map(({ id: _id, resolvedAt: _at, ...rest }) => rest);
    const byId = (xs: typeof before) => [...xs].sort((a, b) => a.sourceAlertId!.localeCompare(b.sourceAlertId!));
    expect(byId(after)).toEqual(byId(before));
    // operatorNote 無しの承認は investigationReport（無ければ汎用文）へフォールバックするのも同じ
    const a1 = (await bySource(ID_APPROVED_1))[0];
    expect(a1.resolvedNote).toBe("プール拡張で解決");
    expect(a1.searchText).toBe("ec.db.pool_exhausted reason=POOL_FULL");
  });

  it("冪等: ES にまだ残っている状態で打っても sourceAlertId ごとに 1件のまま", async () => {
    await submitFeedback();
    const useCase = new RebuildSimilarIncidentsUseCase(alertRepo, similarRepo, logger);

    await useCase.run();
    await useCase.run();

    expect(await findAll()).toHaveLength(2);
    expect(await bySource(ID_APPROVED_1)).toHaveLength(1);
  });

  it("seed は派生の後に入れ直し、同じ sourceAlertId の派生を seed が上書きする", async () => {
    // seed の元 Alert が Mongo に承認済みで存在する（デモのアーカイブ Alert）ケース
    await alertRepo.save(
      makeAlert(SEED_SOURCE_ID, "ec.payment.declined", "PROVIDER_UNAVAILABLE").submitFeedback({
        isCorrect: true,
        operatorNote: "派生側のメモ",
      }),
    );
    const useCase = new RebuildSimilarIncidentsUseCase(alertRepo, similarRepo, logger, [SEED]);

    const result = await useCase.run();
    await useCase.run(); // 2回打っても seed が重複しない

    expect(result).toEqual({ rebuilt: 1, seeded: 1 });
    const seeded = await bySource(SEED_SOURCE_ID);
    expect(seeded).toHaveLength(1);
    expect(seeded[0].resolvedNote).toBe("手で書いた seed のメモ");
    expect(seeded[0].searchText).toBe(SEED.searchText);
  });
});
