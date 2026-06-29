import { InfraMetric } from "../../domain/InfraEvidence.js";
import { CloudMonitoringGateway } from "./CloudMonitoringGateway.js";

// @google-cloud/monitoring（MetricServiceClient）の最小構造的契約。
// 本物の型に依存せず UT で fake クライアントを注入できるようにする
// （実依存は dynamic import で遅延ロード＝ローカル/テスト経路では読み込まない）。
export type TimeSeriesPointLike = {
  readonly interval?: {
    readonly endTime?:
      | { readonly seconds?: number | string }
      | string;
  };
  readonly value?: {
    readonly doubleValue?: number | null;
    readonly int64Value?: number | string | null;
  };
};

export type TimeSeriesLike = {
  readonly metric?: { readonly type?: string };
  readonly points?: TimeSeriesPointLike[];
};

export type MetricClientLike = {
  listTimeSeries(request: unknown): Promise<[TimeSeriesLike[], ...unknown[]]>;
};

export type MetricClientFactory = (
  projectId: string,
) => Promise<MetricClientLike>;

const defaultClientFactory: MetricClientFactory = async (projectId) => {
  // 実環境のみ @google-cloud/monitoring を遅延ロード（ADC 認証）。
  const { MetricServiceClient } = await import("@google-cloud/monitoring");
  return new MetricServiceClient({ projectId }) as unknown as MetricClientLike;
};

// 相関取得するメトリクスの定義（Cloud Run edge の障害症状にフォーカス）。
// AI 調査の「インフラ症状」証拠なので、CPU / メモリ / 5xx の3本を既定で引く。
type MetricSpec = {
  readonly metricType: string;
  readonly displayName: string;
  readonly unit: string;
  readonly extraFilter?: string;
  readonly perSeriesAligner: string;
  readonly crossSeriesReducer: string;
};

const METRIC_SPECS: readonly MetricSpec[] = [
  {
    metricType: "run.googleapis.com/request_count",
    displayName: "5xx レスポンス数",
    unit: "count/s",
    extraFilter: 'metric.labels.response_code_class="5xx"',
    perSeriesAligner: "ALIGN_RATE",
    crossSeriesReducer: "REDUCE_SUM",
  },
  {
    metricType: "run.googleapis.com/container/cpu/utilizations",
    displayName: "CPU 使用率",
    unit: "ratio",
    perSeriesAligner: "ALIGN_PERCENTILE_99",
    crossSeriesReducer: "REDUCE_MAX",
  },
  {
    metricType: "run.googleapis.com/container/memory/utilizations",
    displayName: "メモリ使用率",
    unit: "ratio",
    perSeriesAligner: "ALIGN_PERCENTILE_99",
    crossSeriesReducer: "REDUCE_MAX",
  },
];

const DEFAULT_WINDOW_MINUTES = 30;
const ALIGNMENT_PERIOD_SECONDS = 60;

// Google Cloud Monitoring API へのアダプタ（CPU/メモリ/5xx の時系列を窓で取得・読み取り専用）。
//
// モック切り替え（ローカル ⇄ 実環境）は CloudLoggingGatewayImpl と同型:
//   - projectId 未設定（GCP_PROJECT_ID / GOOGLE_CLOUD_PROJECT が無い）→ [] を返す＝ローカル既定。
//   - CLOUD_MONITORING_ENABLED=false → project があっても明示的に無効化。
//   - projectId あり ＆ 無効化なし → 実 API を叩く（worker SA に roles/monitoring.viewer が必要）。
//
// 1メトリクスの取得失敗は全体を落とさず該当メトリクスを飛ばす（ベストエフォート＝証拠収集の方針）。
export class CloudMonitoringGatewayImpl implements CloudMonitoringGateway {
  private readonly projectId: string;
  private readonly enabled: boolean;
  private readonly clientFactory: MetricClientFactory;

  constructor(
    projectId: string = process.env.GCP_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      "",
    options: {
      enabled?: boolean;
      clientFactory?: MetricClientFactory;
    } = {},
  ) {
    this.projectId = projectId;
    this.enabled =
      options.enabled ?? process.env.CLOUD_MONITORING_ENABLED !== "false";
    this.clientFactory = options.clientFactory ?? defaultClientFactory;
  }

  async getMetrics(params: {
    occurredOn: Date;
    windowMinutes?: number;
  }): Promise<InfraMetric[]> {
    if (!this.enabled || !this.projectId) return [];

    const windowMinutes = params.windowMinutes ?? DEFAULT_WINDOW_MINUTES;
    const start = new Date(
      params.occurredOn.getTime() - windowMinutes * 60 * 1000,
    );

    const client = await this.clientFactory(this.projectId);

    const results = await Promise.all(
      METRIC_SPECS.map((spec) =>
        this.tryFetchOne(client, spec, start, params.occurredOn),
      ),
    );
    return results.filter((m): m is InfraMetric => m !== null);
  }

  private async tryFetchOne(
    client: MetricClientLike,
    spec: MetricSpec,
    start: Date,
    end: Date,
  ): Promise<InfraMetric | null> {
    try {
      const request = this.buildRequest(spec, start, end);
      const [timeSeries] = await client.listTimeSeries(request);
      return this.summarize(spec, timeSeries);
    } catch {
      // 該当メトリクスが無効/未収集でも調査は継続する。
      return null;
    }
  }

  private buildRequest(spec: MetricSpec, start: Date, end: Date): unknown {
    const filter = spec.extraFilter
      ? `metric.type="${spec.metricType}" AND ${spec.extraFilter}`
      : `metric.type="${spec.metricType}"`;
    return {
      name: `projects/${this.projectId}`,
      filter,
      interval: {
        startTime: { seconds: Math.floor(start.getTime() / 1000) },
        endTime: { seconds: Math.floor(end.getTime() / 1000) },
      },
      aggregation: {
        alignmentPeriod: { seconds: ALIGNMENT_PERIOD_SECONDS },
        perSeriesAligner: spec.perSeriesAligner,
        crossSeriesReducer: spec.crossSeriesReducer,
      },
      // 全リソース横断の集約系列を1本受ける（view=FULL）。
      view: "FULL",
    };
  }

  // 集約後の時系列（通常1本）から窓内の latest/max と点数を抽出する。
  private summarize(spec: MetricSpec, timeSeries: TimeSeriesLike[]): InfraMetric {
    const points = timeSeries.flatMap((s) => s.points ?? []);
    const values = points
      .map((p) => this.pointValue(p))
      .filter((v): v is number => v !== null);

    // points は通常 endTime 降順（新しい順）。latest は先頭。
    const latest = values.length > 0 ? values[0] : null;
    const max = values.length > 0 ? Math.max(...values) : null;

    return {
      metricType: spec.metricType,
      displayName: spec.displayName,
      unit: spec.unit,
      latest,
      max,
      points: values.length,
    };
  }

  private pointValue(point: TimeSeriesPointLike): number | null {
    const v = point.value;
    if (!v) return null;
    if (typeof v.doubleValue === "number") return v.doubleValue;
    if (v.int64Value !== null && v.int64Value !== undefined) {
      const n = Number(v.int64Value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
}
