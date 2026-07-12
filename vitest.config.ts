import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // frontend は jsdom + 独自 alias の別プロジェクト（vitest.workspace.ts）で実行する。
    // *.int.test.ts は docker（Mongo/RabbitMQ）必須の結合テストなので unit run からは除外し、
    // 各 package の vitest.integration.config.ts（test:integration）でのみ実行する。
    exclude: [
      "e2e/**",
      "node_modules/**",
      "src/apps/backoffice/frontend/**",
      "**/*.int.test.ts",
      // `pnpm build`（tsc）が dist にコンパイル済み *.test.js を吐くと unit run が拾って
      // 全ファイル collect 失敗する（vitest は CJS 出力を import できない）。ソースのみ対象にする。
      "dist/**",
    ],
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/Contexts/Shared"),
      "@ec": resolve(__dirname, "src/Contexts/EC"),
      "@monitoring": resolve(__dirname, "src/Contexts/Monitoring"),
    },
  },
});
