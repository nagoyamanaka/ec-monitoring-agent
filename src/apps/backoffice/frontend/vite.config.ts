import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import type { IncomingMessage } from "http";

const API_TARGET = process.env.BACKOFFICE_API ?? "http://localhost:3001";

/**
 * バックエンドAPI（/alerts, /analytics 等）と SPA のクライアントルートが同一パスで衝突する。
 * ブラウザのドキュメントナビゲーション（Accept: text/html）は index.html を返して SPA に委ね、
 * fetch（Accept: application/json）/ EventSource（text/event-stream）はバックエンドへ転送する。
 */
const spaAwareApi = (): ProxyOptions => ({
  target: API_TARGET,
  changeOrigin: true,
  bypass: (req: IncomingMessage) =>
    req.headers.accept?.includes("text/html") ? "/index.html" : undefined,
});

const apiOnly = (): ProxyOptions => ({
  target: API_TARGET,
  changeOrigin: true,
});

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@features": resolve(__dirname, "src/features"),
      "@monitoring": resolve(__dirname, "../../../Contexts/Monitoring"),
    },
  },
  server: {
    // コンテナ外（docker）からアクセスできるよう 0.0.0.0 で待ち受ける
    host: true,
    proxy: {
      // SPA ルートと衝突するため bypass 付き（/alerts/stream の SSE も text/html 以外なので転送される）
      "/alerts": spaAwareApi(),
      "/analytics": spaAwareApi(),
      "/forecast": spaAwareApi(),
      // API 専用（対応する SPA ルート無し）
      "/demo": apiOnly(),
      "/patterns": apiOnly(),
      "/health": apiOnly(),
    },
  },
});
