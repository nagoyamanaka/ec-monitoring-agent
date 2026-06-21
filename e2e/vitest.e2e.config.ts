import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.e2e.test.ts"],
    globalSetup: ["./global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // EC backend の demo モードは全プロセス共有のグローバル状態。
    // ファイル並列実行だと payment/inventory モード設定が競合するため直列化する。
    fileParallelism: false,
  },
});
