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

  it("シナリオ4（security-vuln）は CI(Trivy)検知を合成し CollectMonitoringEventUseCase に流す", async () => {
    const useCase = new TriggerDemoScenarioUseCase(
      fakeEcGateway(),
      "p-1",
      fakeInfraStore(),
      collect,
    );

    const result = await useCase.run("4");

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

  it("シナリオ3b（infra-fault-synthetic）は apply 差分を記録し、INFRASTRUCTURE の合成イベントを実経路へ流す", async () => {
    const store = fakeInfraStore();
    const useCase = new TriggerDemoScenarioUseCase(fakeEcGateway(), "p-1", store, collect);

    const result = await useCase.run("3b");

    expect(result).toEqual({
      scenarioId: "infra-fault-synthetic",
      label: "インフラ障害（合成・反復用）",
      orderId: "",
    });

    // ① 直前の apply 差分（Cloud SQL の設定縮小）が記録される＝調査が時間窓で root cause として引ける。
    expect(store.record).toHaveBeenCalledTimes(1);
    const recorded = (store.record as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppliedInfraChange;
    expect(recorded.resourceChanges[0].address).toBe("google_sql_database_instance.main");
    // 由来 PR URL 未設定なら url は付けない（合成 sha からリンクを組み立てて 404 を作らない）。
    expect(recorded.url).toBeUndefined();

    // ② 合成イベントが実 ingest 経路へ流れ、INFRASTRUCTURE 分類で調査が terraform 差分を収集できる。
    expect(collect.run).toHaveBeenCalledTimes(1);
    const event = (collect.run as ReturnType<typeof vi.fn>).mock.calls[0][0] as MonitoringEvent;
    expect(event.category.value).toBe("INFRASTRUCTURE");
    expect(event.isAlertable()).toBe(true);
  });

  it("infra-fault-synthetic は設定された実在 PR URL を apply 差分に添える（証拠の原典リンク）", async () => {
    const store = fakeInfraStore();
    const useCase = new TriggerDemoScenarioUseCase(
      fakeEcGateway(),
      "p-1",
      store,
      collect,
      "https://github.com/o/r/pull/30",
    );

    await useCase.run("3b");

    const recorded = (store.record as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppliedInfraChange;
    expect(recorded.url).toBe("https://github.com/o/r/pull/30");
  });

  it("未知シナリオは UnsupportedScenarioError", async () => {
    const useCase = new TriggerDemoScenarioUseCase(fakeEcGateway(), "p-1", fakeInfraStore(), collect);
    await expect(useCase.run("nope")).rejects.toBeInstanceOf(UnsupportedScenarioError);
  });

  it("デモ卓から撤退した旧シナリオ 5/6 のエイリアスは受けない（UnsupportedScenarioError）", async () => {
    const useCase = new TriggerDemoScenarioUseCase(fakeEcGateway(), "p-1", fakeInfraStore(), collect);
    await expect(useCase.run("5")).rejects.toBeInstanceOf(UnsupportedScenarioError);
    await expect(useCase.run("6")).rejects.toBeInstanceOf(UnsupportedScenarioError);
  });
});
