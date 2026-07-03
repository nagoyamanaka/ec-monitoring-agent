import { defineConfig } from "vitest/config";
import { resolve } from "path";

// src は @monitoring / @shared / @ec の path alias を使う（tsconfig paths）。
// vitest でも同じ alias を解決させる（ルート vitest.config.ts と同一・基点はリポジトリルート）。
const repoRoot = resolve(__dirname, "../../../..");

// 結合テスト（backend ルーティング ↔ context 配線）の実行設定。
// - 外部（Gemini / GitHub）はモック：LLM は Stub に、PR起票は BackofficeApp の override で差し替える。
// - Mongo / RabbitMQ は docker compose の実体に接続する（`docker compose -f docker-compose.local.yml up -d mongo rabbitmq`）。
// unit run（ルート vitest）からは *.int.test.ts を除外済みなので、ここでだけ走る。
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/integration/**/*.int.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 共有 Mongo/RabbitMQ への副作用が混ざらないよう直列化する。
    fileParallelism: false,
    // config.ts は process.env を import 時に1回読むため、ここで先に注入する。
    env: {
      // Gemini を Stub に（課金・非決定性を排除）。advisory の planner も決定論フォールバックに落ちる。
      AI_INVESTIGATION_STUB: "true",
      // in-process advisory 経路（PR起票の口＝RemediationPort を override で差し替える前提）。
      REMEDIATION_MODE: "advisory",
      // SimilarIncident は InMemory にフォールバック（ES 無しで動かす）。
      ELASTICSEARCH_URL: "",
      // ingest ルートの x-ingest-token 認証を有効化（401/202 を検証する）。
      INGEST_TOKEN: "it-token",
      // demo ルート（demoGuard）を 404 にせず通す。
      DEMO_ENABLED: "true",
      // forecast ルート（forecastGuard）を 404 にせず通す（生成は forecastPort override で決定論化）。
      FORECAST_ENABLED: "true",
      // dev データを汚さないよう専用 DB を使う。
      MONGO_URL: process.env.MONGO_URL ?? "mongodb://localhost:27017/monitoring_integration",
      RABBITMQ_HOST: process.env.RABBITMQ_HOST ?? "localhost",
      RABBITMQ_PORT: process.env.RABBITMQ_PORT ?? "5672",
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(repoRoot, "src/Contexts/Shared"),
      "@ec": resolve(repoRoot, "src/Contexts/EC"),
      "@monitoring": resolve(repoRoot, "src/Contexts/Monitoring"),
    },
  },
});
