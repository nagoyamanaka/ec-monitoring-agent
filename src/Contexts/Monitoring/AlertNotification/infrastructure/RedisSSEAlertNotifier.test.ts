import { describe, it, expect, beforeEach } from "vitest";
import { Response } from "express";
import { RedisSSEAlertNotifier } from "./RedisSSEAlertNotifier.js";
import {
  ValkeyConnection,
  ValkeyMessageHandler,
} from "../../../Shared/infrastructure/valkey/ValkeyConnection.js";

// publish を記録し、subscribe ハンドラを手で発火できる fake。
class FakeValkeyConnection implements ValkeyConnection {
  readonly enabled = true;
  readonly published: Array<{ channel: string; message: string }> = [];
  subscribedChannels: string[] = [];
  private handler: ValkeyMessageHandler | null = null;

  async get(): Promise<string | null> {
    return null;
  }
  async set(): Promise<void> {}
  async del(): Promise<void> {}

  async publish(channel: string, message: string): Promise<void> {
    this.published.push({ channel, message });
  }
  async subscribe(
    channels: string[],
    handler: ValkeyMessageHandler,
  ): Promise<void> {
    this.subscribedChannels = channels;
    this.handler = handler;
  }
  async close(): Promise<void> {}

  // テストから「Valkey が message を配信した」を再現する。
  deliver(channel: string, message: string): void {
    this.handler?.(channel, message);
  }
}

// SSE 書き込みを捕捉する最小 Response。
function fakeResponse(): Response & { writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    write: (chunk: string) => writes.push(chunk),
    on: () => {},
  } as unknown as Response & { writes: string[] };
}

describe("RedisSSEAlertNotifier", () => {
  let valkey: FakeValkeyConnection;
  let notifier: RedisSSEAlertNotifier;

  beforeEach(() => {
    valkey = new FakeValkeyConnection();
    notifier = new RedisSSEAlertNotifier(valkey);
  });

  describe("publish 側（worker）", () => {
    it("notify は alert を alert channel に publish する（ローカルへ直接書かない）", () => {
      const res = fakeResponse();
      notifier.addConnection(res);

      const alert = { id: "alert-1", status: "investigating" } as never;
      notifier.notify(alert);

      expect(valkey.published).toEqual([
        {
          channel: RedisSSEAlertNotifier.ALERT_CHANNEL,
          message: JSON.stringify(alert),
        },
      ]);
      // publish のみが配信経路。購読していないこの notifier ではローカルに書き込まれない。
      expect(res.writes).toEqual([]);
    });

    it("notifyRemediation は remediation channel に publish する", () => {
      const remediation = { alertId: "alert-1", status: "drafted" } as never;
      notifier.notifyRemediation(remediation);

      expect(valkey.published).toEqual([
        {
          channel: RedisSSEAlertNotifier.REMEDIATION_CHANNEL,
          message: JSON.stringify(remediation),
        },
      ]);
    });
  });

  describe("subscribe→fan-out 側（edge）", () => {
    it("startFanOut で両 channel を購読する", async () => {
      await notifier.startFanOut();

      expect(valkey.subscribedChannels).toEqual([
        RedisSSEAlertNotifier.ALERT_CHANNEL,
        RedisSSEAlertNotifier.REMEDIATION_CHANNEL,
      ]);
    });

    it("alert channel の受信を接続中クライアントへ既定イベントで fan-out する", async () => {
      await notifier.startFanOut();
      const res = fakeResponse();
      notifier.addConnection(res);

      const alert = { id: "alert-9" };
      valkey.deliver(
        RedisSSEAlertNotifier.ALERT_CHANNEL,
        JSON.stringify(alert),
      );

      expect(res.writes).toEqual([`data: ${JSON.stringify(alert)}\n\n`]);
    });

    it("remediation channel の受信は名前付きイベント remediation で fan-out する", async () => {
      await notifier.startFanOut();
      const res = fakeResponse();
      notifier.addConnection(res);

      const remediation = { alertId: "alert-9", status: "failed" };
      valkey.deliver(
        RedisSSEAlertNotifier.REMEDIATION_CHANNEL,
        JSON.stringify(remediation),
      );

      expect(res.writes).toEqual([
        `event: remediation\ndata: ${JSON.stringify(remediation)}\n\n`,
      ]);
    });

    it("壊れた（非JSON）メッセージは捨てて投げない", async () => {
      await notifier.startFanOut();
      const res = fakeResponse();
      notifier.addConnection(res);

      expect(() =>
        valkey.deliver(RedisSSEAlertNotifier.ALERT_CHANNEL, "not-json{"),
      ).not.toThrow();
      expect(res.writes).toEqual([]);
    });
  });
});
