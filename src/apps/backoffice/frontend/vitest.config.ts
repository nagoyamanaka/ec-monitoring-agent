import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * フロントの vitest 設定。vite.config の alias（@shared/@features/@monitoring）と
 * react plugin をそのまま再利用し、test 層だけ jsdom + RTL setup を足す。
 * ルートの node プロジェクトとは alias が衝突する（@shared がフロントとバックで別物）ため、
 * ルート vitest.config.ts は本ディレクトリを exclude し、本プロジェクトとして分離する。
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: "backoffice-frontend",
      globals: true,
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  }),
);
