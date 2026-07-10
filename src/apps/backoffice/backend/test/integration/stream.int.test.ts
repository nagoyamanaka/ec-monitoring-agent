import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { startApp } from "./support.js";

/**
 * routes/streamRoutes.ts に 1:1 対応。
 * GET /alerts/stream（SSE）。長時間接続なので本文の完了は待たず、
 * ヘッダ（200・text/event-stream）が返った時点で検証して接続を破棄する。
 * supertest は本文 end を待ってしまうため、実ポートに listen して fetch でヘッダだけ受ける。
 */
describe("streamRoutes (integration)", () => {
  let app: BackofficeApp;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = await startApp();
    app = started.app;
    server = app.httpApp.listen(0);
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app?.stop();
  });

  it("GET /alerts/stream は SSE ヘッダで開通する", async () => {
    const controller = new AbortController();
    // fetch はヘッダ受信時点で resolve する（body は stream のまま）。
    const res = await fetch(`${baseUrl}/alerts/stream`, { signal: controller.signal });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);

    controller.abort();
  });

  it("接続直後にコメント行が届く（Cloud Run のヘッダ保留対策・E7）", async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/alerts/stream`, { signal: controller.signal });

    // 初回 heartbeat（30秒）を待たずに最初のチャンクが読めること。
    // これが無いと GFE がヘッダごと保留し、EventSource の onopen が発火しない。
    const reader = res.body!.getReader();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("first chunk not received within 2s")), 2_000),
    );
    const { value } = await Promise.race([reader.read(), timeout]);
    expect(new TextDecoder().decode(value)).toContain(": connected");

    controller.abort();
  });
});
