// HTTP クライアント抽象（プロトコル非依存）。
// *Api.ts は本 interface にのみ依存し、テスト時はモック実装に差し替える。
// REST は抽象化しない方針だが、テスト容易性とエラー/タイムアウトの一元化のため薄い IF を置く。

export interface HttpRequestOptions {
  /** クエリ文字列。undefined の値は送出しない。 */
  query?: Record<string, string | number | boolean | undefined>;
  /** 追加ヘッダー。 */
  headers?: Record<string, string>;
  /** 呼び出し側からの中断シグナル（タイムアウトとは別に合成される）。 */
  signal?: AbortSignal;
  /** この呼び出しのタイムアウト（ms）。未指定なら実装のデフォルトを使う。 */
  timeoutMs?: number;
}

export interface HttpClient {
  get<T>(path: string, options?: HttpRequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
  delete<T>(path: string, options?: HttpRequestOptions): Promise<T>;
}

/** 2xx 以外のレスポンスで投げるエラー。status とパース済み body を保持する。 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown,
  ) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
  }
}

/** タイムアウト超過で投げるエラー。 */
export class HttpTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "HttpTimeoutError";
  }
}
