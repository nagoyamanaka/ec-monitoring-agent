import { EcBackendApp } from "./EcBackendApp.js";

new EcBackendApp().start().catch((error: unknown) => {
  console.error(JSON.stringify({
    severity: "FATAL",
    service: "ec-backend",
    message: "Bootstrap failed",
    stack_trace: error instanceof Error ? error.stack : String(error),
    timestamp: new Date().toISOString(),
  }));
  process.exit(1);
});
