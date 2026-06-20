import { NodeSDK } from "@opentelemetry/sdk-node";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { BackofficeApp } from "./BackofficeApp.js";

const sdk = new NodeSDK({
  serviceName: "backoffice-backend",
  traceExporter: new TraceExporter(),
});

sdk.start();

process.on("SIGTERM", async () => {
  await sdk.shutdown();
  process.exit(0);
});

new BackofficeApp().start().catch((error: unknown) => {
  console.error(JSON.stringify({
    severity: "FATAL",
    service: "backoffice-backend",
    message: "Bootstrap failed",
    stack_trace: error instanceof Error ? error.stack : String(error),
    timestamp: new Date().toISOString(),
  }));
  process.exit(1);
});
