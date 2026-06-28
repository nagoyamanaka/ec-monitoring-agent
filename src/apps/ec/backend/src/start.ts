import { NodeSDK } from "@opentelemetry/sdk-node";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { EcBackendApp } from "./EcBackendApp.js";
import { GcpCloudLoggingLogger } from "../../../../Contexts/Shared/infrastructure/logging/GcpCloudLoggingLogger.js";

const sdk = new NodeSDK({
  serviceName: "ec-backend",
  traceExporter: new TraceExporter(),
});

sdk.start();

process.on("SIGTERM", async () => {
  await sdk.shutdown();
  process.exit(0);
});

// bootstrap 失敗時は DI コンテナが組み上がっていない（＝アプリの Logger を取り出せない）ので、
// ここで最小限の Logger を直接生成して構造化 CRITICAL を出す。出力経路・JSON 形は通常ログと同一。
new EcBackendApp().start().catch(async (error: unknown) => {
  await new GcpCloudLoggingLogger().critical({
    service: "ec-backend",
    message: "Bootstrap failed",
    stack_trace: error instanceof Error ? error.stack : String(error),
  });
  process.exit(1);
});
