import { AppLogEntry } from "../../domain/InfraEvidence.js";
import { CloudLoggingGateway } from "./CloudLoggingGateway.js";

// @google-cloud/logging の最小構造的契約。
// 本物の型に依存せず、UT で fake クライアントを注入できるようにする
// （実依存は dynamic import で遅延ロード＝ローカル/テスト経路では読み込まない）。
export type LogEntryLike = {
  readonly metadata?: {
    readonly severity?: string | number;
    readonly timestamp?: string | Date | { seconds?: number | string };
    readonly resource?: { readonly labels?: Record<string, string> };
  };
  readonly data?: unknown;
};

export type LoggingClientLike = {
  getEntries(options: {
    filter: string;
    orderBy?: string;
    pageSize?: number;
  }): Promise<[LogEntryLike[], ...unknown[]]>;
};

export type LoggingClientFactory = (
  projectId: string,
) => Promise<LoggingClientLike>;

const defaultClientFactory: LoggingClientFactory = async (projectId) => {
  // 実環境のみ @google-cloud/logging を遅延ロード（ADC 認証）。
  const { Logging } = await import("@google-cloud/logging");
  return new Logging({ projectId }) as unknown as LoggingClientLike;
};

const DEFAULT_WINDOW_MINUTES = 30;
const DEFAULT_PAGE_SIZE = 50;

// Google Cloud Logging API へのアダプタ（severity>=WARNING を時間窓で取得・読み取り専用）。
//
// モック切り替え（ローカル ⇄ 実環境）:
//   - projectId 未設定（GCP_PROJECT_ID / GOOGLE_CLOUD_PROJECT が無い）→ [] を返す＝ローカル既定。
//   - CLOUD_LOGGING_ENABLED=false → project があっても明示的に無効化（ADC はあるが API を叩きたくない時）。
//   - projectId あり ＆ 無効化なし → 実 API を叩く（worker SA に roles/logging.viewer が必要）。
export class CloudLoggingGatewayImpl implements CloudLoggingGateway {
  private readonly projectId: string;
  private readonly enabled: boolean;
  private readonly pageSize: number;
  private readonly clientFactory: LoggingClientFactory;

  constructor(
    projectId: string = process.env.GCP_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      "",
    options: {
      enabled?: boolean;
      pageSize?: number;
      clientFactory?: LoggingClientFactory;
    } = {},
  ) {
    this.projectId = projectId;
    this.enabled =
      options.enabled ?? process.env.CLOUD_LOGGING_ENABLED !== "false";
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    this.clientFactory = options.clientFactory ?? defaultClientFactory;
  }

  async getAppLogs(params: {
    service: string;
    occurredOn: Date;
    windowMinutes?: number;
  }): Promise<AppLogEntry[]> {
    if (!this.enabled || !this.projectId) return [];

    const windowMinutes = params.windowMinutes ?? DEFAULT_WINDOW_MINUTES;
    const start = new Date(
      params.occurredOn.getTime() - windowMinutes * 60 * 1000,
    );
    const filter = this.buildFilter(params.service, start, params.occurredOn);

    const client = await this.clientFactory(this.projectId);
    const [entries] = await client.getEntries({
      filter,
      orderBy: "timestamp desc",
      pageSize: this.pageSize,
    });

    return entries.map((entry) => this.toAppLogEntry(entry, params.service));
  }

  private buildFilter(service: string, start: Date, end: Date): string {
    // service はドメイン内部値（MonitoringEvent.source）だが、念のため "（フィルタ境界）を除去。
    const safeService = service.replace(/"/g, "");
    return [
      `resource.type="cloud_run_revision"`,
      `resource.labels.service_name="${safeService}"`,
      `severity>=WARNING`,
      `timestamp>="${start.toISOString()}"`,
      `timestamp<="${end.toISOString()}"`,
    ].join(" AND ");
  }

  private toAppLogEntry(entry: LogEntryLike, fallbackResource: string): AppLogEntry {
    return {
      timestamp: this.parseTimestamp(entry.metadata?.timestamp),
      severity: this.normalizeSeverity(entry.metadata?.severity),
      message: this.extractMessage(entry.data),
      resource:
        entry.metadata?.resource?.labels?.service_name ?? fallbackResource,
    };
  }

  private parseTimestamp(
    raw: string | Date | { seconds?: number | string } | undefined,
  ): Date {
    if (raw instanceof Date) return raw;
    if (typeof raw === "string") return new Date(raw);
    if (raw && typeof raw === "object" && raw.seconds !== undefined) {
      return new Date(Number(raw.seconds) * 1000);
    }
    return new Date();
  }

  // Cloud Logging の severity（文字列 or 数値 enum）を AppLogEntry の 3 段階に丸める。
  private normalizeSeverity(
    raw: string | number | undefined,
  ): AppLogEntry["severity"] {
    if (typeof raw === "number") {
      // LogSeverity enum: ERROR=500, WARNING=400。
      if (raw >= 500) return "ERROR";
      if (raw >= 400) return "WARNING";
      return "INFO";
    }
    const s = (raw ?? "").toUpperCase();
    if (s === "ERROR" || s === "CRITICAL" || s === "ALERT" || s === "EMERGENCY")
      return "ERROR";
    if (s === "WARNING") return "WARNING";
    return "INFO";
  }

  private extractMessage(data: unknown): string {
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
      return JSON.stringify(data);
    }
    return "";
  }
}
