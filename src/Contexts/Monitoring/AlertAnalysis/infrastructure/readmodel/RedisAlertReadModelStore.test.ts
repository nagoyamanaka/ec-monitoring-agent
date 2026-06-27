import { describe, it, expect, beforeEach } from "vitest";
import { RedisAlertReadModelStore } from "./RedisAlertReadModelStore.js";
import type { AlertPrimitives } from "../../domain/Alert.js";
import {
  ValkeyConnection,
  ValkeyMessageHandler,
} from "../../../../Shared/infrastructure/valkey/ValkeyConnection.js";

// in-memory KV の fake（task16 の disabled とは別物＝有効相当）。
class FakeValkeyConnection implements ValkeyConnection {
  readonly enabled = true;
  readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
  async publish(): Promise<void> {}
  async subscribe(_c: string[], _h: ValkeyMessageHandler): Promise<void> {}
  async close(): Promise<void> {}
}

const alertPrimitives = (id: string): AlertPrimitives =>
  ({ id, status: "OPEN" }) as unknown as AlertPrimitives;

describe("RedisAlertReadModelStore", () => {
  let valkey: FakeValkeyConnection;
  let store: RedisAlertReadModelStore;

  beforeEach(() => {
    valkey = new FakeValkeyConnection();
    store = new RedisAlertReadModelStore(valkey);
  });

  it("saveAlert→getAlert が id キーで round-trip する", async () => {
    const alert = alertPrimitives("a1");
    await store.saveAlert(alert);

    expect(await store.getAlert("a1")).toEqual(alert);
    expect(valkey.store.has("monitoring:readmodel:alert:a1")).toBe(true);
  });

  it("未保存の id は null（→ Mongo フォールバック）", async () => {
    expect(await store.getAlert("missing")).toBeNull();
  });

  it("saveList→getList が一覧スナップショットを round-trip する", async () => {
    const list = [alertPrimitives("a1"), alertPrimitives("a2")];
    await store.saveList(list);

    expect(await store.getList()).toEqual(list);
  });

  it("invalidateList 後は getList が null（次回 Mongo から再構築）", async () => {
    await store.saveList([alertPrimitives("a1")]);
    await store.invalidateList();

    expect(await store.getList()).toBeNull();
  });

  it("壊れた JSON は miss 扱い（null）にしてフォールバックさせる", async () => {
    valkey.store.set("monitoring:readmodel:alert:a1", "not-json{");

    expect(await store.getAlert("a1")).toBeNull();
  });
});
