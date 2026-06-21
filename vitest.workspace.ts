import { defineWorkspace } from "vitest/config";

/**
 * vitest プロジェクト定義。
 * - ルート（node 環境・バックエンド/contexts）: ./vitest.config.ts
 * - バックオフィス frontend（jsdom 環境・React コンポーネント）: 各 vitest.config.ts
 * `vitest run` で双方をまとめて実行する。
 */
export default defineWorkspace([
  "./vitest.config.ts",
  "./src/apps/backoffice/frontend/vitest.config.ts",
]);
