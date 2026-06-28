import { NodeSDK } from "@opentelemetry/sdk-node";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { BackofficeApp } from "./BackofficeApp.js";
import { GcpCloudLoggingLogger } from "../../../../Contexts/Shared/infrastructure/logging/GcpCloudLoggingLogger.js";

const sdk = new NodeSDK({
  serviceName: "backoffice-backend",
  traceExporter: new TraceExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      // fs 計装はスパン数が爆発するため無効化
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", async () => {
  await sdk.shutdown();
  process.exit(0);
});

// bootstrap 失敗時は DI コンテナが組み上がっていない（＝アプリの Logger を取り出せない）ので、
// ここで最小限の Logger を直接生成して構造化 CRITICAL を出す。出力経路・JSON 形は通常ログと同一。
new BackofficeApp().start().catch(async (error: unknown) => {
  await new GcpCloudLoggingLogger().critical({
    service: "backoffice-backend",
    message: "Bootstrap failed",
    stack_trace: error instanceof Error ? error.stack : String(error),
  });
  process.exit(1);
});
