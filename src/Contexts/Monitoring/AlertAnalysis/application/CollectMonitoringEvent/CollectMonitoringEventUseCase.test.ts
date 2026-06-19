import { describe, it, expect, vi, beforeEach } from "vitest";
import { CollectMonitoringEventUseCase } from "./CollectMonitoringEventUseCase.js";
import { AnalyzeAlertCommandHandler } from "../AnalyzeAlert/AnalyzeAlertCommandHandler.js";
import { AnalyzeAlertCommand } from "../AnalyzeAlert/AnalyzeAlertCommand.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const makeMonitoringEvent = () =>
  new MonitoringEvent({
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    eventName: "ec.payment.timeout",
    aggregateId: "550e8400-e29b-41d4-a716-446655440001",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    category: MonitoringEventCategory.application(),
    source: "payment",
    payload: { orderId: "order-1", customerId: "cust-1", amount: 5000 },
  });

describe("CollectMonitoringEventUseCase", () => {
  let handler: { handle: ReturnType<typeof vi.fn> };
  let logger: ConsoleLogger;
  let useCase: CollectMonitoringEventUseCase;

  beforeEach(() => {
    handler = { handle: vi.fn().mockResolvedValue(undefined) };
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new CollectMonitoringEventUseCase(
      handler as unknown as AnalyzeAlertCommandHandler,
      logger,
    );
  });

  describe("ハンドラが正常終了する場合", () => {
    it("AnalyzeAlertCommandHandler.handle が1回呼ばれる", async () => {
      await useCase.run(makeMonitoringEvent());

      expect(handler.handle).toHaveBeenCalledOnce();
    });

    it("コマンドに渡した MonitoringEvent の primitives が含まれる", async () => {
      const monitoringEvent = makeMonitoringEvent();
      await useCase.run(monitoringEvent);

      const [command] = handler.handle.mock.calls[0] as [AnalyzeAlertCommand];
      expect(command.monitoringEvent).toEqual(monitoringEvent.toPrimitives());
    });

    it("コマンドの alertId は UUID v4 形式である", async () => {
      await useCase.run(makeMonitoringEvent());

      const [command] = handler.handle.mock.calls[0] as [AnalyzeAlertCommand];
      expect(command.alertId).toMatch(UUID_V4_PATTERN);
    });
  });

  describe("ハンドラがエラーを投げる場合", () => {
    it("エラーが呼び出し元に再スローされる", async () => {
      handler.handle.mockRejectedValue(new Error("handler failure"));

      await expect(useCase.run(makeMonitoringEvent())).rejects.toThrow("handler failure");
    });
  });
});
