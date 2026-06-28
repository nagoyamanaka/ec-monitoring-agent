import { describe, it, expect, vi, beforeEach } from "vitest";
import { TriggerDemoScenarioUseCase, UnsupportedScenarioError } from "./TriggerDemoScenarioUseCase.js";
import { EcDemoGateway } from "./EcDemoGateway.js";
import {
  AppliedInfraChange,
  AppliedInfraChangeStore,
} from "../../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/AppliedInfraChangeStore.js";
import { CollectMonitoringEventUseCase } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { MonitoringEvent } from "../../../../../Contexts/Monitoring/Shared/domain/MonitoringEvent.js";

function fakeEcGateway(): EcDemoGateway {
  return {
    setPaymentMode: vi.fn().mockResolvedValue(undefined),
    setInventoryMode: vi.fn().mockResolvedValue(undefined),
    placeOrder: vi.fn().mockResolvedValue({ orderId: "o-1" }),
    injectInfraFault: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeInfraStore(): AppliedInfraChangeStore {
  return {
    record: vi.fn<[AppliedInfraChange], Promise<void>>().mockResolvedValue(undefined),
  } as unknown as AppliedInfraChangeStore;
}

describe("TriggerDemoScenarioUseCase", () => {
  let collect: CollectMonitoringEventUseCase;

  beforeEach(() => {
    collect = { run: vi.fn().mockResolvedValue(undefined) } as unknown as CollectMonitoringEventUseCase;
  });

  it("シナリオ5（security-vuln）は CI(Trivy)検知を合成し CollectMonitoringEventUseCase に流す", async () => {
    const useCase = new TriggerDemoScenarioUseCase(
      fakeEcGateway(),
      "p-1",
      fakeInfraStore(),
      collect,
    );

    const result = await useCase.run("5");

    expect(result).toEqual({ scenarioId: "security-vuln", label: "脆弱性検知", orderId: "" });
    expect(collect.run).toHaveBeenCalledTimes(1);

    // 実在 ingest と同じ変換経路を辿るので、CRITICAL = isAlertable で調査に乗る MonitoringEvent になる。
    const event = (collect.run as ReturnType<typeof vi.fn>).mock.calls[0][0] as MonitoringEvent;
    expect(event.category.value).toBe("SECURITY");
    expect(event.isAlertable()).toBe(true);
    expect(event.payload.vulnerabilityCount).toBe(2);
  });

  it("security-vuln では EC への注文投入を行わない（検知の合成のみ）", async () => {
    const ec = fakeEcGateway();
    const useCase = new TriggerDemoScenarioUseCase(ec, "p-1", fakeInfraStore(), collect);

    await useCase.run("security-vuln");

    expect(ec.placeOrder).not.toHaveBeenCalled();
    expect(ec.injectInfraFault).not.toHaveBeenCalled();
  });

  it("未知シナリオは UnsupportedScenarioError", async () => {
    const useCase = new TriggerDemoScenarioUseCase(fakeEcGateway(), "p-1", fakeInfraStore(), collect);
    await expect(useCase.run("nope")).rejects.toBeInstanceOf(UnsupportedScenarioError);
  });
});
