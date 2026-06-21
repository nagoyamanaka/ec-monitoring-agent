import {
  HttpClient,
  HttpError,
  HttpRequestOptions,
  HttpTimeoutError,
} from "./HttpClient";

export interface FetchHttpClientConfig {
  /** 例: "" （vite proxy 前提の相対）または "http://localhost:3001"。 */
  baseURL?: string;
  /** 既定タイムアウト（ms）。呼び出し側 options.timeoutMs が優先。 */
  timeoutMs?: number;
  /** 全リクエスト共通ヘッダー。 */
  defaultHeaders?: Record<string, string>;
}

/**
 * fetch ベースの薄い HttpClient 実装（axios 不使用＝サプライチェーンリスク回避）。
 * - baseURL 連結・クエリ組み立て
 * - AbortController によるタイムアウト（呼び出し側 signal と合成）
 * - 非 2xx は HttpError、タイムアウトは HttpTimeoutError
 * - レスポンスは JSON を優先パース（空 body は undefined）
 */
export class FetchHttpClient implements HttpClient {
  private readonly baseURL: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: FetchHttpClientConfig = {}) {
    this.baseURL = (config.baseURL ?? "").replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.defaultHeaders = config.defaultHeaders ?? {};
  }

  get<T>(path: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>("GET", path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>("POST", path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>("PATCH", path, body, options);
  }

  delete<T>(path: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    options?: HttpRequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    options?.signal?.addEventListener("abort", onExternalAbort);

    const hasBody = body !== undefined && body !== null;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.defaultHeaders,
      ...options?.headers,
    };
    if (hasBody) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      // 呼び出し側 signal による中断はそのまま伝播、タイムアウトは専用エラーに変換
      if (controller.signal.aborted && !options?.signal?.aborted) {
        throw new HttpTimeoutError(timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener("abort", onExternalAbort);
    }

    const payload = await this.parseBody(response);
    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, payload);
    }
    return payload as T;
  }

  private buildUrl(
    path: string,
    query?: HttpRequestOptions["query"],
  ): string {
    const base = `${this.baseURL}${path.startsWith("/") ? path : `/${path}`}`;
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.append(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  private async parseBody(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return JSON.parse(text);
    }
    return text;
  }
}
