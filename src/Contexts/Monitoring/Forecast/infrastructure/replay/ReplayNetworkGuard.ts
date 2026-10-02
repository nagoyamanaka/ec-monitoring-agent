import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

/**
 * リプレイ中の外部通信の遮断（T0-2）。fetch・http(s)・net/tls の接続口を
 * 「許可したホスト以外は必ず例外を投げる」実装に差し替える。
 * 許可するのは予報器そのもの（LLM のエンドポイント）だけ＝証拠を取りに行く通信
 * （GitHub・terraform・ES・Mongo など）はすべて落ちる。stub の予報器なら許可ゼロ。
 *
 * 遮断は例外で知らせるが、呼び出し先が例外を握りつぶす（例: LLM 例外 → fallback 予報）と
 * 気づけないので、試みた接続は violations にも残す。判定は violations で行うこと。
 * UNIX ドメインソケット（path 指定の net 接続）はプロセス内の IPC なので遮断しない。
 */
export class ReplayNetworkBlockedError extends Error {
  constructor(readonly attempts: readonly string[]) {
    super(`リプレイ中に外部通信を試みました（入力は snapshot のみのはず）: ${attempts.join(", ")}`);
    this.name = "ReplayNetworkBlockedError";
  }
}

export type HostAllowlist = (host: string) => boolean;

export const ALLOW_NONE: HostAllowlist = () => false;

export type NetworkSeal = {
  readonly violations: readonly string[];
  restore(): void;
};

export function sealNetwork(allow: HostAllowlist): NetworkSeal {
  const violations: string[] = [];
  const guard = (host: string | undefined, via: string): void => {
    const normalized = (host ?? "localhost").replace(/^\[|\]$/g, "").toLowerCase();
    if (allow(normalized)) return;
    const attempt = `${via}:${normalized}`;
    violations.push(attempt);
    throw new ReplayNetworkBlockedError([attempt]);
  };

  const originals = {
    fetch: globalThis.fetch,
    httpRequest: http.request,
    httpGet: http.get,
    httpsRequest: https.request,
    httpsGet: https.get,
    netConnect: net.connect,
    netCreateConnection: net.createConnection,
    tlsConnect: tls.connect,
  };

  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    try {
      guard(urlOf(input).hostname, "fetch");
    } catch (error) {
      return Promise.reject(error);
    }
    return originals.fetch(input, init);
  }) as typeof fetch;

  const wrapHttp = <F extends (...args: never[]) => unknown>(original: F, via: string): F =>
    ((...args: unknown[]) => {
      guard(hostOfRequestArgs(args), via);
      return (original as unknown as (...a: unknown[]) => unknown)(...args);
    }) as unknown as F;
  http.request = wrapHttp(originals.httpRequest, "http");
  http.get = wrapHttp(originals.httpGet, "http");
  https.request = wrapHttp(originals.httpsRequest, "https");
  https.get = wrapHttp(originals.httpsGet, "https");

  const wrapSocket = <F extends (...args: never[]) => unknown>(original: F, via: string): F =>
    ((...args: unknown[]) => {
      const first = args[0];
      const isIpc =
        typeof first === "string" ||
        (typeof first === "object" && first !== null && "path" in first && !("host" in first));
      if (!isIpc) guard(hostOfSocketArgs(args), via);
      return (original as unknown as (...a: unknown[]) => unknown)(...args);
    }) as unknown as F;
  net.connect = wrapSocket(originals.netConnect, "net");
  net.createConnection = wrapSocket(originals.netCreateConnection, "net");
  tls.connect = wrapSocket(originals.tlsConnect, "tls");

  return {
    violations,
    restore() {
      globalThis.fetch = originals.fetch;
      http.request = originals.httpRequest;
      http.get = originals.httpGet;
      https.request = originals.httpsRequest;
      https.get = originals.httpsGet;
      net.connect = originals.netConnect;
      net.createConnection = originals.netCreateConnection;
      tls.connect = originals.tlsConnect;
    },
  };
}

function urlOf(input: Parameters<typeof fetch>[0]): URL {
  if (input instanceof URL) return input;
  if (typeof input === "string") return new URL(input);
  return new URL(input.url);
}

// http.request(url | options, [options], [cb]) の各形からホストを取る。
function hostOfRequestArgs(args: unknown[]): string | undefined {
  const [first, second] = args;
  if (typeof first === "string" || first instanceof URL) return new URL(first).hostname;
  const options = (typeof first === "object" && first !== null ? first : second) as
    | { hostname?: string; host?: string }
    | undefined;
  return options?.hostname ?? options?.host?.split(":")[0];
}

// net.connect(options | port, [host]) の各形からホストを取る。
function hostOfSocketArgs(args: unknown[]): string | undefined {
  const [first, second] = args;
  if (typeof first === "number") return typeof second === "string" ? second : undefined;
  const options = first as { host?: string; servername?: string } | undefined;
  return options?.host ?? options?.servername;
}
