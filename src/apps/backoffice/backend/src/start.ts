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

// bootstrap 前でも使える最小 Logger（DI コンテナ非依存）。プロセスレベルの
// エラーハンドラは container が組み上がる前後どちらでも発火し得るのでこれを使う。
const processLogger = new GcpCloudLoggingLogger();

process.on("SIGTERM", async () => {
  await sdk.shutdown();
  process.exit(0);
});

// 長期稼働サービスのプロセスレベル・セーフティネット。
// Node 15+ は未処理の Promise 却下（unhandledRejection）で既定でプロセスを終了する。
// 非同期の周辺経路（メッセージ consumer のデシリアライズ失敗・fire-and-forget な
// 通知など）で 1 件でも却下が漏れると backend 全体が落ち、E2E では以降の全リクエストが
// ENOTFOUND で連鎖失敗する。ここで握って CRITICAL を残し、プロセスは生かし続ける
// （個々の経路での握り＝真の修正は別途。これは網＝単発の漏れで全滅させないため）。
process.on("unhandledRejection", (reason: unknown) => {
  void processLogger
    .critical({
      service: "backoffice-backend",
      message: "Unhandled promise rejection（プロセスは継続）",
      stack_trace: reason instanceof Error ? reason.stack : String(reason),
    })
    .catch(() => {});
});

process.on("uncaughtException", (error: unknown) => {
  void processLogger
    .critical({
      service: "backoffice-backend",
      message: "Uncaught exception（プロセスは継続）",
      stack_trace: error instanceof Error ? error.stack : String(error),
    })
    .catch(() => {});
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
