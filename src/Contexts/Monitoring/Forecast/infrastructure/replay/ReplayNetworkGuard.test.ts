import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { ALLOW_NONE, NetworkSeal, ReplayNetworkBlockedError, sealNetwork } from "./ReplayNetworkGuard.js";

describe("sealNetwork", () => {
  let seal: NetworkSeal | null = null;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    seal?.restore();
    seal = null;
    globalThis.fetch = originalFetch;
  });

  it("fetch は許可外のホストへ出ようとすると例外で落ち、試みを violations に残す", async () => {
    seal = sealNetwork(ALLOW_NONE);
    await expect(fetch("https://api.github.com/repos/x/y/pulls")).rejects.toThrow(
      ReplayNetworkBlockedError,
    );
    expect(seal.violations).toEqual(["fetch:api.github.com"]);
  });

  it("http(s).request / get と net / tls の接続も許可外は例外で落ちる", () => {
    seal = sealNetwork(ALLOW_NONE);
    expect(() => https.request("https://api.github.com/")).toThrow(ReplayNetworkBlockedError);
    expect(() => http.get({ hostname: "elasticsearch", port: 9200 })).toThrow(ReplayNetworkBlockedError);
    expect(() => net.connect({ host: "mongo", port: 27017 })).toThrow(ReplayNetworkBlockedError);
    expect(() => net.createConnection(27017, "mongo")).toThrow(ReplayNetworkBlockedError);
    expect(() => tls.connect({ host: "api.github.com", port: 443 })).toThrow(ReplayNetworkBlockedError);
    expect(seal.violations).toEqual([
      "https:api.github.com",
      "http:elasticsearch",
      "net:mongo",
      "net:mongo",
      "tls:api.github.com",
    ]);
  });

  it("許可したホスト（予報器の LLM）への fetch は元の fetch にそのまま通す", async () => {
    const underlying = vi.fn(async () => new Response("ok"));
    globalThis.fetch = underlying as unknown as typeof fetch;
    seal = sealNetwork((host) => host === "generativelanguage.googleapis.com");

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models");

    expect(await res.text()).toBe("ok");
    expect(underlying).toHaveBeenCalledTimes(1);
    expect(seal.violations).toEqual([]);
  });

  it("restore で元の実装に戻る", () => {
    const before = { fetch: globalThis.fetch, request: https.request, connect: net.connect };
    sealNetwork(ALLOW_NONE).restore();
    expect(globalThis.fetch).toBe(before.fetch);
    expect(https.request).toBe(before.request);
    expect(net.connect).toBe(before.connect);
  });
});
