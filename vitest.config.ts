import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // frontend は jsdom + 独自 alias の別プロジェクト（vitest.workspace.ts）で実行する
    exclude: ["e2e/**", "node_modules/**", "src/apps/backoffice/frontend/**"],
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/Contexts/Shared"),
      "@ec": resolve(__dirname, "src/Contexts/EC"),
      "@monitoring": resolve(__dirname, "src/Contexts/Monitoring"),
    },
  },
});
