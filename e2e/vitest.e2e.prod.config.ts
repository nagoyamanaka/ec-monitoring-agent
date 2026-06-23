import { defineConfig } from "vitest/config";

// CD デプロイ後の smoke テスト用設定。
// - Mongo に直接アクセスしない（E2E_SEED=false → global-setup が seedInventory をスキップ）。
// - 状態変更を伴わないテストのみ含める（demo-reset は POST /demo/reset でサーバ側が seed）。
// - URL は CD パイプラインが環境変数で注入する（デフォルトなし → 未設定なら即エラー）。
export default defineConfig({
  test: {
    include: ["backoffice/demo-reset.e2e.test.ts"],
    globalSetup: ["./global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      EC_BASE_URL: process.env.EC_BASE_URL ?? "",
      BACKOFFICE_BASE_URL: process.env.BACKOFFICE_BASE_URL ?? "",
      MONGO_URL: "",
      MONITORING_MONGO_URL: "",
      E2E_SEED: "false",
    },
  },
});
