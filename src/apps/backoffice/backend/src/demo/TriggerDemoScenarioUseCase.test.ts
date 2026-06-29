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

  it("シナリオ6（infra-config-change）は apply 差分を記録し、INFRASTRUCTURE の合成イベントを実経路へ流す", async () => {
    const store = fakeInfraStore();
    const useCase = new TriggerDemoScenarioUseCase(fakeEcGateway(), "p-1", store, collect);

    const result = await useCase.run("6");

    expect(result).toEqual({ scenarioId: "infra-config-change", label: "構成変更障害", orderId: "" });

    // ① 直前の apply 差分（Cloud SQL の設定縮小）が記録される＝調査が時間窓で root cause として引ける。
    expect(store.record).toHaveBeenCalledTimes(1);
    const recorded = (store.record as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppliedInfraChange;
    expect(recorded.resourceChanges[0].address).toBe("google_sql_database_instance.main");

    // ② 合成イベントが実 ingest 経路へ流れ、INFRASTRUCTURE 分類で調査が terraform 差分を収集できる。
    expect(collect.run).toHaveBeenCalledTimes(1);
    const event = (collect.run as ReturnType<typeof vi.fn>).mock.calls[0][0] as MonitoringEvent;
    expect(event.category.value).toBe("INFRASTRUCTURE");
    expect(event.isAlertable()).toBe(true);
  });

  it("infra-config-change では EC への注文投入・障害注入を行わない（検知の合成のみ）", async () => {
    const ec = fakeEcGateway();
    const useCase = new TriggerDemoScenarioUseCase(ec, "p-1", fakeInfraStore(), collect);

    await useCase.run("infra-config-change");

    expect(ec.placeOrder).not.toHaveBeenCalled();
    expect(ec.injectInfraFault).not.toHaveBeenCalled();
  });

  it("シナリオ7（appcode-regression）は APPLICATION の合成イベントを実経路へ流す（注文/注入なし）", async () => {
    const ec = fakeEcGateway();
    const useCase = new TriggerDemoScenarioUseCase(ec, "p-1", fakeInfraStore(), collect);

    const result = await useCase.run("7");

    expect(result).toEqual({ scenarioId: "appcode-regression", label: "アプリコード退行", orderId: "" });

    // 検知の入口だけ合成。UNKNOWN→AI 調査に乗る APPLICATION の CRITICAL イベントになる。
    expect(collect.run).toHaveBeenCalledTimes(1);
    const event = (collect.run as ReturnType<typeof vi.fn>).mock.calls[0][0] as MonitoringEvent;
    expect(event.category.value).toBe("APPLICATION");
    expect(event.isAlertable()).toBe(true);
    expect(event.source).toBe("ec-backend");
    // seed の類似コーパスと語彙が被らない eventName＝類似検索が誤って既知に寄せず UNKNOWN→AI 調査に乗る。
    expect(event.eventName).toBe("ec.pricing.subtotal_mismatch");
    // 日本語プローズを payload に入れない（kuromoji 無しの偶発一致→BM25 飽和→偽 KNOWN を防ぐ）。
    expect(JSON.stringify(event.payload)).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);

    // 注文投入・障害注入は伴わない（合成検知のみ）。
    expect(ec.placeOrder).not.toHaveBeenCalled();
    expect(ec.injectInfraFault).not.toHaveBeenCalled();
  });

  it("未知シナリオは UnsupportedScenarioError", async () => {
    const useCase = new TriggerDemoScenarioUseCase(fakeEcGateway(), "p-1", fakeInfraStore(), collect);
    await expect(useCase.run("nope")).rejects.toBeInstanceOf(UnsupportedScenarioError);
  });
});
