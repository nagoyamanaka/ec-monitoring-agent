import { describe, it, expect } from "vitest";
import { createValkeyConnection } from "./ValkeyConnectionFactory.js";
import { DisabledValkeyConnection } from "./DisabledValkeyConnection.js";
import { IoRedisValkeyConnection } from "./IoRedisValkeyConnection.js";

describe("createValkeyConnection", () => {
  describe("REDIS_URL 未設定（空）", () => {
    it("null object（DisabledValkeyConnection）にフォールバックする", () => {
      const connection = createValkeyConnection({ url: "" });

      expect(connection).toBeInstanceOf(DisabledValkeyConnection);
      expect(connection.enabled).toBe(false);
    });

    it("read-model は常に miss（null）を返し、publish/subscribe/set は no-op で投げない", async () => {
      const connection = createValkeyConnection({ url: "" });

      await expect(connection.get("alert:1")).resolves.toBeNull();
      await expect(
        connection.set("alert:1", "{}", 60),
      ).resolves.toBeUndefined();
      await expect(connection.del("alert:1")).resolves.toBeUndefined();
      await expect(
        connection.publish("alerts", "{}"),
      ).resolves.toBeUndefined();
      await expect(
        connection.subscribe(["alerts"], () => {}),
      ).resolves.toBeUndefined();
      await expect(connection.close()).resolves.toBeUndefined();
    });
  });

  describe("REDIS_URL 設定", () => {
    it("実接続（IoRedisValkeyConnection）を生成する（lazyConnect で接続はしない）", async () => {
      const connection = createValkeyConnection({
        url: "redis://localhost:6379",
      });

      expect(connection).toBeInstanceOf(IoRedisValkeyConnection);
      expect(connection.enabled).toBe(true);

      // lazyConnect のため構築だけでは接続を張らない。後始末で破棄する。
      await connection.close();
    });
  });
});
