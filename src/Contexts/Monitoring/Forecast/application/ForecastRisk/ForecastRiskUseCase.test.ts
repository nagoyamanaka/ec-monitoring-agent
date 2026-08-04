import { describe, it, expect } from "vitest";
import { ForecastRiskUseCase } from "./ForecastRiskUseCase.js";
import { ForecastBriefing, RiskForecastRepository } from "../../domain/ForecastBriefing.js";
import { ForecastContext } from "../../domain/ForecastContext.js";
import { ForecastMemoryEntry, ForecastMemoryRepository } from "../../domain/ForecastMemory.js";
import { ForecastPort } from "../../domain/ForecastPort.js";
import { ForecastSignal, ForecastSignalKind } from "../../domain/ForecastSignal.js";
import { ForecastSignalSource } from "../../domain/ForecastSignalSource.js";
import { RiskForecast, RiskItem } from "../../domain/RiskForecast.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { StructuredLog } from "../../../../Shared/domain/logging/StructuredLog.js";

const signal = (id: string, subject: string): ForecastSignal => ({
  id,
  kind: ForecastSignalKind.FUTURE_CHANGE,
  subject,
  when: "未マージ",
  desc: `${subject} の変更`,
  source: `github.${id}`,
});

class FakeSource implements ForecastSignalSource {
  collectedHorizons: string[] = [];
  constructor(private readonly signals: ForecastSignal[]) {}
  async collect(horizon: string): Promise<ForecastSignal[]> {
    this.collectedHorizons.push(horizon);
    return this.signals;
  }
}

class FakeMemory implements ForecastMemoryRepository {
  askedSubjects: string[][] = [];
  warmUpCount = 0;
  constructor(private readonly entries: ForecastMemoryEntry[] = []) {}
  async warmUp(): Promise<void> {
    this.warmUpCount += 1;
  }
  async findBySubjects(subjects: string[]): Promise<ForecastMemoryEntry[]> {
    this.askedSubjects.push(subjects);
    return this.entries;
  }
}

class FakePort implements ForecastPort {
  contexts: ForecastContext[] = [];
  constructor(private readonly risks: RiskItem[], private readonly isFallback = false) {}
  async forecast(context: ForecastContext): Promise<RiskForecast> {
    this.contexts.push(context);
    return {
      forecastId: "f-1",
      generatedAt: new Date("2026-07-03T00:00:00.000Z"),
      horizon: context.horizon,
      risks: this.risks,
      isFallback: this.isFallback,
    };
  }
}

class FakeRepository implements RiskForecastRepository {
  saved: ForecastBriefing[] = [];
  // Mongo 実装と同じ意味論: clear() は履歴を消さず、読み取り対象から外すだけ。
  private discardedUpTo = 0;
  async append(briefing: ForecastBriefing): Promise<void> {
    this.saved.push(briefing);
  }
  async findLatest(): Promise<ForecastBriefing | null> {
    if (this.saved.length <= this.discardedUpTo) return null;
    return this.saved[this.saved.length - 1] ?? null;
  }
  // 測定の標本は破棄済みも含む全件（Mongo 実装と同じ）。
  async findAll(): Promise<ForecastBriefing[]> {
    return [...this.saved];
  }
  async clear(): Promise<void> {
    this.discardedUpTo = this.saved.length;
  }
}

class RecordingLogger extends Logger {
  logs: StructuredLog[] = [];
  async write(log: StructuredLog): Promise<void> {
    this.logs.push(log);
  }
}

const risk = (subject: string, citations: string[], level: RiskItem["level"] = "HIGH"): RiskItem => ({
  window: "土 20:00",
  subject,
  level,
  confidence: 0.8,
  citations,
  reasoning: "根拠",
});

const build = (params: {
  sources: ForecastSignalSource[];
  memory?: ForecastMemoryRepository;
  port: ForecastPort;
}) => {
  const repository = new FakeRepository();
  const logger = new RecordingLogger();
  const useCase = new ForecastRiskUseCase(
    params.sources,
    params.memory ?? new FakeMemory(),
    params.port,
    repository,
    logger,
  );
  return { useCase, repository, logger };
};

describe("ForecastRiskUseCase", () => {
  it("全 Source を horizon 付きで回し、主シグナル+MEMORY を結合して Port に渡す", async () => {
    const source1 = new FakeSource([signal("pr-1", "db_connection_pool")]);
    const source2 = new FakeSource([signal("sch-1", "checkout")]);
    const memory = new FakeMemory([
      {
        incidentId: "alert-123",
        subject: "db_connection_pool_exhaustion",
        trigger: "ec.db.connection_pool_exhausted",
        outcome: "pool 上限を拡大して解消",
      },
    ]);
    const port = new FakePort([risk("db_connection_pool", ["pr-1", "inc-1"])]);
    const { useCase, repository } = build({ sources: [source1, source2], memory, port });

    await useCase.run({ horizon: "今週末" });

    expect(source1.collectedHorizons).toEqual(["今週末"]);
    expect(source2.collectedHorizons).toEqual(["今週末"]);
    // 記憶は生成時点の最新投影へ再 warmUp してから、主シグナルの subject（重複除去済み）で引く
    expect(memory.warmUpCount).toBe(1);
    expect(memory.askedSubjects).toEqual([["db_connection_pool", "checkout"]]);
    // Port へは主シグナル + MEMORY 正規化済みの全量
    expect(port.contexts).toHaveLength(1);
    expect(port.contexts[0].horizon).toBe("今週末");
    expect(port.contexts[0].signals.map((s) => s.id)).toEqual(["pr-1", "sch-1", "inc-1"]);
    const memorySignal = port.contexts[0].signals[2];
    expect(memorySignal.kind).toBe(ForecastSignalKind.MEMORY);
    expect(memorySignal.source).toBe("incident.alert-123");
    expect(memorySignal.desc).toContain("pool 上限を拡大して解消");
    // 保存されたブリーフィングにもシグナル全量が同梱される（引用チップの解決先）
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0].signals).toHaveLength(3);
    expect(repository.saved[0].forecast.risks).toHaveLength(1);
  });

  it("同一 url を複数ソースが拾ったら1本に畳み、terraform.plan を open PR より優先する", async () => {
    const url = "https://github.com/o/r/pull/83";
    // open PR ソース（先に collect される）と terraform.plan ソースが同じ #83 を指す。
    const prSignal: ForecastSignal = {
      id: "pr-83",
      kind: ForecastSignalKind.FUTURE_CHANGE,
      subject: "chore_infra_vm",
      when: "未マージ",
      desc: "[draft] VM を e2-small に縮小",
      source: "github.pr#83",
      url,
    };
    const planSignal: ForecastSignal = {
      id: "plan-1",
      kind: ForecastSignalKind.FUTURE_CHANGE,
      subject: "module_gce_backbone_google_compute_instance_backbone",
      when: "plan済み・未適用",
      desc: "VM machine_type 縮小",
      source: "terraform.plan",
      url,
    };
    const otherPr: ForecastSignal = {
      id: "pr-55",
      kind: ForecastSignalKind.FUTURE_CHANGE,
      subject: "chore_db_pool",
      when: "未マージ",
      desc: "pool 縮小",
      source: "github.pr#55",
      url: "https://github.com/o/r/pull/55",
    };
    const port = new FakePort([risk("db_connection_pool", ["plan-1", "pr-55"])]);
    const { useCase } = build({
      sources: [new FakeSource([prSignal, otherPr]), new FakeSource([planSignal])],
      port,
    });

    await useCase.run({ horizon: "今週末" });

    // #83 は plan-1（terraform.plan）1本に畳まれ、pr-83 は落ちる。別 PR の pr-55 は残る。
    const ids = port.contexts[0].signals.map((s) => s.id);
    expect(ids).toContain("plan-1");
    expect(ids).not.toContain("pr-83");
    expect(ids).toContain("pr-55");
  });

  it("引用検証: 偽引用は citations から落とし、裏付けゼロのリスクは丸ごと落とす", async () => {
    const port = new FakePort([
      risk("real", ["pr-1"]),
      risk("mixed", ["pr-1", "ghost-9"]),
      risk("all-fake", ["ghost-1", "ghost-2"]),
      risk("uncited", []),
    ]);
    const { useCase, repository, logger } = build({
      sources: [new FakeSource([signal("pr-1", "db_connection_pool")])],
      port,
    });

    await useCase.run({ horizon: "今週末" });

    const saved = repository.saved[0].forecast.risks;
    expect(saved.map((r) => r.subject)).toEqual(["real", "mixed"]);
    expect(saved[1].citations).toEqual(["pr-1"]); // ghost-9 は破棄
    const actions = logger.logs.map((l) => l.action);
    expect(actions.filter((a) => a === "forecast_fake_citation_dropped")).toHaveLength(2);
    expect(actions.filter((a) => a === "forecast_uncited_risk_dropped")).toHaveLength(2);
  });

  it("落とした側の会計を予報に載せる（E6-1・判定は変えない）", async () => {
    const port = new FakePort([
      risk("real", ["pr-1"]), // 引用1・破棄0
      risk("mixed", ["pr-1", "ghost-9"]), // 引用2・破棄1
      risk("all-fake", ["ghost-1", "ghost-2"]), // 引用2・リスクごと破棄
      risk("uncited", []), // 引用0・リスクごと破棄
    ]);
    const { useCase, repository } = build({
      sources: [new FakeSource([signal("pr-1", "db_connection_pool")])],
      port,
    });

    await useCase.run({ horizon: "今週末" });

    expect(repository.saved[0].forecast.verification).toEqual({
      citationsEmitted: 5,
      citationsDropped: 3,
      risksEmitted: 4,
      risksDropped: 2,
    });
  });

  it("forecast_generated ログが level 内訳と MEMORY 引用の有無を持つ（E6-3 の最小形）", async () => {
    const memory = new FakeMemory([
      {
        incidentId: "alert-123",
        subject: "db_connection_pool",
        trigger: "ec.db.connection_pool_exhausted",
        outcome: "pool 上限を拡大して解消",
      },
    ]);
    const port = new FakePort([
      risk("with-memory", ["pr-1", "inc-1"], "HIGH"),
      risk("without-memory", ["pr-1"], "LOW"),
    ]);
    const { useCase, logger } = build({
      sources: [new FakeSource([signal("pr-1", "db_connection_pool")])],
      memory,
      port,
    });

    await useCase.run({ horizon: "今週末" });

    const generated = logger.logs.find((l) => l.action === "forecast_generated");
    expect(generated?.message).toContain("levels=HIGH=1,MEDIUM=0,LOW=1");
    expect(generated?.message).toContain("withMemoryCitation=1");
  });

  it("シグナル0件なら Port を呼ばず空予報（isFallback=false）を保存する", async () => {
    const port = new FakePort([risk("any", ["pr-1"])]);
    const memory = new FakeMemory();
    const { useCase, repository, logger } = build({
      sources: [new FakeSource([])],
      memory,
      port,
    });

    await useCase.run({ horizon: "今週末" });

    expect(port.contexts).toHaveLength(0); // Gemini 非呼び出し
    expect(memory.warmUpCount).toBe(0); // 主シグナル0件なら記憶の再投影もしない
    expect(memory.askedSubjects).toHaveLength(0);
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0].forecast.risks).toEqual([]);
    expect(repository.saved[0].forecast.isFallback).toBe(false);
    expect(repository.saved[0].forecast.horizon).toBe("今週末");
    expect(logger.logs[0].action).toBe("forecast_no_signals");
  });

  it("Port の fallback（isFallback=true）はそのまま保存する", async () => {
    const port = new FakePort([], true);
    const { useCase, repository } = build({
      sources: [new FakeSource([signal("pr-1", "db_connection_pool")])],
      port,
    });

    await useCase.run({ horizon: "今週末" });

    expect(repository.saved[0].forecast.isFallback).toBe(true);
    expect(repository.saved[0].forecast.risks).toEqual([]);
    expect(repository.saved[0].signals).toHaveLength(1); // fallback でも収集済みシグナルは残す
  });
});
