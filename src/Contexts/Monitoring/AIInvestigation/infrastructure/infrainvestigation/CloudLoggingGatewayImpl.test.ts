import { describe, expect, it, vi } from "vitest";
import {
  CloudLoggingGatewayImpl,
  LogEntryLike,
  LoggingClientLike,
} from "./CloudLoggingGatewayImpl.js";

const OCCURRED_ON = new Date("2026-06-28T12:00:00.000Z");

function fakeClient(
  entries: LogEntryLike[],
  spy?: (filter: string) => void,
): LoggingClientLike {
  return {
    async getEntries(options) {
      spy?.(options.filter);
      return [entries];
    },
  };
}

describe("CloudLoggingGatewayImpl", () => {
  it("projectId が空なら API を叩かず [] を返す（ローカル既定）", async () => {
    const factory = vi.fn();
    const gateway = new CloudLoggingGatewayImpl("", { clientFactory: factory });

    const logs = await gateway.getAppLogs({
      service: "backoffice",
      occurredOn: OCCURRED_ON,
    });

    expect(logs).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });

  it("enabled=false なら project があっても [] を返す（明示的無効化）", async () => {
    const factory = vi.fn();
    const gateway = new CloudLoggingGatewayImpl("proj-1", {
      enabled: false,
      clientFactory: factory,
    });

    const logs = await gateway.getAppLogs({
      service: "backoffice",
      occurredOn: OCCURRED_ON,
    });

    expect(logs).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });

  it("service / severity>=WARNING / 時間窓を含むフィルタを組み立てる", async () => {
    let captured = "";
    const gateway = new CloudLoggingGatewayImpl("proj-1", {
      clientFactory: async () => fakeClient([], (f) => (captured = f)),
    });

    await gateway.getAppLogs({
      service: "backoffice",
      occurredOn: OCCURRED_ON,
      windowMinutes: 30,
    });

    expect(captured).toContain('resource.labels.service_name="backoffice"');
    expect(captured).toContain("severity>=WARNING");
    expect(captured).toContain('timestamp>="2026-06-28T11:30:00.000Z"');
    expect(captured).toContain('timestamp<="2026-06-28T12:00:00.000Z"');
  });

  it("LogEntry を AppLogEntry に正規化する（severity 丸め・jsonPayload.message 抽出）", async () => {
    const entries: LogEntryLike[] = [
      {
        metadata: {
          severity: "CRITICAL",
          timestamp: "2026-06-28T11:59:00.000Z",
          resource: { labels: { service_name: "backoffice-worker" } },
        },
        data: { message: "bootstrap failed", severity: "CRITICAL" },
      },
      {
        metadata: { severity: 400, timestamp: new Date("2026-06-28T11:58:00.000Z") },
        data: "plain text warning",
      },
    ];
    const gateway = new CloudLoggingGatewayImpl("proj-1", {
      clientFactory: async () => fakeClient(entries),
    });

    const logs = await gateway.getAppLogs({
      service: "backoffice",
      occurredOn: OCCURRED_ON,
    });

    expect(logs[0]).toEqual({
      timestamp: new Date("2026-06-28T11:59:00.000Z"),
      severity: "ERROR", // CRITICAL → ERROR に丸め
      message: "bootstrap failed", // jsonPayload.message を抽出
      resource: "backoffice-worker",
    });
    expect(logs[1].severity).toBe("WARNING"); // 数値 enum 400 → WARNING
    expect(logs[1].message).toBe("plain text warning"); // textPayload はそのまま
    expect(logs[1].resource).toBe("backoffice"); // resource ラベル無し → service フォールバック
  });
});
