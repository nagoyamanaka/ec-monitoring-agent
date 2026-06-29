import { describe, expect, it, vi } from "vitest";
import {
  CloudMonitoringGatewayImpl,
  MetricClientLike,
  TimeSeriesLike,
} from "./CloudMonitoringGatewayImpl.js";

const OCCURRED_ON = new Date("2026-06-28T12:00:00.000Z");

// listTimeSeries の filter から metric.type を抜き、spec ごとに別の系列を返す fake。
function fakeClient(
  byMetricType: Record<string, TimeSeriesLike[]>,
  spy?: (filter: string) => void,
): MetricClientLike {
  return {
    async listTimeSeries(request: unknown) {
      const filter = (request as { filter?: string }).filter ?? "";
      spy?.(filter);
      const match = filter.match(/metric\.type="([^"]+)"/);
      const type = match?.[1] ?? "";
      return [byMetricType[type] ?? []];
    },
  };
}

describe("CloudMonitoringGatewayImpl", () => {
  it("projectId が空なら API を叩かず [] を返す（ローカル既定）", async () => {
    const factory = vi.fn();
    const gateway = new CloudMonitoringGatewayImpl("", { clientFactory: factory });

    const metrics = await gateway.getMetrics({ occurredOn: OCCURRED_ON });

    expect(metrics).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });

  it("enabled=false なら project があっても [] を返す（明示的無効化）", async () => {
    const factory = vi.fn();
    const gateway = new CloudMonitoringGatewayImpl("proj-1", {
      enabled: false,
      clientFactory: factory,
    });

    const metrics = await gateway.getMetrics({ occurredOn: OCCURRED_ON });

    expect(metrics).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });

  it("5xx フィルタと時間窓を含むリクエストを組み立てる", async () => {
    const filters: string[] = [];
    const gateway = new CloudMonitoringGatewayImpl("proj-1", {
      clientFactory: async () => fakeClient({}, (f) => filters.push(f)),
    });

    await gateway.getMetrics({ occurredOn: OCCURRED_ON, windowMinutes: 30 });

    const fivexx = filters.find((f) => f.includes("request_count"));
    expect(fivexx).toContain('metric.labels.response_code_class="5xx"');
  });

  it("時系列を latest/max/points に圧縮する（latest=先頭・max=窓内最大）", async () => {
    const cpuType = "run.googleapis.com/container/cpu/utilizations";
    const series: TimeSeriesLike[] = [
      {
        metric: { type: cpuType },
        points: [
          { value: { doubleValue: 0.42 } }, // 新しい順（latest）
          { value: { doubleValue: 0.95 } }, // 窓内 max
          { value: { doubleValue: 0.5 } },
        ],
      },
    ];
    const gateway = new CloudMonitoringGatewayImpl("proj-1", {
      clientFactory: async () => fakeClient({ [cpuType]: series }),
    });

    const metrics = await gateway.getMetrics({ occurredOn: OCCURRED_ON });
    const cpu = metrics.find((m) => m.metricType === cpuType);

    expect(cpu).toMatchObject({
      displayName: "CPU 使用率",
      unit: "ratio",
      latest: 0.42,
      max: 0.95,
      points: 3,
    });
  });

  it("int64Value も数値化する／空系列は latest/max=null・points=0", async () => {
    const reqType = "run.googleapis.com/request_count";
    const series: TimeSeriesLike[] = [
      { metric: { type: reqType }, points: [{ value: { int64Value: "7" } }] },
    ];
    const gateway = new CloudMonitoringGatewayImpl("proj-1", {
      clientFactory: async () => fakeClient({ [reqType]: series }),
    });

    const metrics = await gateway.getMetrics({ occurredOn: OCCURRED_ON });

    const fivexx = metrics.find((m) => m.metricType === reqType);
    expect(fivexx).toMatchObject({ latest: 7, max: 7, points: 1 });

    // CPU/メモリは空系列 → latest/max=null
    const cpu = metrics.find((m) => m.metricType.includes("cpu"));
    expect(cpu).toMatchObject({ latest: null, max: null, points: 0 });
  });

  it("1メトリクスの取得失敗は他を落とさない（ベストエフォート）", async () => {
    const reqType = "run.googleapis.com/request_count";
    const client: MetricClientLike = {
      async listTimeSeries(request: unknown) {
        const filter = (request as { filter?: string }).filter ?? "";
        if (filter.includes("cpu")) throw new Error("permission denied");
        if (filter.includes(reqType)) {
          return [[{ metric: { type: reqType }, points: [{ value: { int64Value: 3 } }] }]];
        }
        return [[]];
      },
    };
    const gateway = new CloudMonitoringGatewayImpl("proj-1", {
      clientFactory: async () => client,
    });

    const metrics = await gateway.getMetrics({ occurredOn: OCCURRED_ON });

    // cpu は落ちたが request_count / memory は残る
    expect(metrics.some((m) => m.metricType.includes("cpu"))).toBe(false);
    expect(metrics.find((m) => m.metricType === reqType)?.latest).toBe(3);
  });
});
