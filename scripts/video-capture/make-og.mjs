// OGP 画像（1200×630）を新ブランドマーク「次の一点」＋名称「Kizashi AI-SRE」で再生成する。
// 旧 og-image（public/og-image.png）は旧意匠（青タイル＋EKG）＋旧名称「EC Monitoring Agent」で
// 二重に古い。マークは public/favicon.svg / BrandMark.tsx と同一の SVG をそのまま埋め込み（座標無改変）。
// 使い方: node make-og.mjs   （前提: pnpm run setup 済み＝chromium 取得済み）
// 出力: src/apps/backoffice/frontend/public/og-image.png（フロント配信の /og-image.png 実体）。
//       dist/ はビルドで再生成されるためここでは触らない。
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../src/apps/backoffice/frontend/public/og-image.png");

const W = 1200,
  H = 630;

// BrandMark.tsx / favicon.svg と同一意匠「次の一点」（実線=観測済みの軌跡・cyan 点=軌道延長上の予測）。
// viewBox 64×64 のパスは一切変えず、外枠だけ拡大して埋め込む（点は軌道の延長線上・座標変更禁止）。
const MARK = `
  <svg width="104" height="104" viewBox="0 0 64 64" fill="none">
    <rect width="64" height="64" rx="14" fill="#0c1626"/>
    <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke="#94b4d4" stroke-opacity="0.25"/>
    <polyline points="14,45 27,45 36,32.4" stroke="#e6f4ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="46.5" cy="17.5" r="6" fill="#22d3ee"/>
  </svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  .stage{position:relative;width:${W}px;height:${H}px;background:
      radial-gradient(1200px 700px at 78% -10%, rgba(34,211,238,.10), rgba(11,18,32,0) 60%),
      linear-gradient(160deg,#0d1526 0%,#0B1220 55%,#0a1120 100%);
      font-family:"Noto Sans CJK JP",sans-serif;-webkit-font-smoothing:antialiased;
      padding:88px 96px;display:flex;flex-direction:column}
  .lockup{display:flex;align-items:center;gap:26px}
  .word{display:flex;align-items:baseline;gap:18px}
  .word .name{font-weight:700;font-size:76px;letter-spacing:.01em;color:#F2F6FC;line-height:1}
  .word .sub{font-weight:600;font-size:30px;letter-spacing:.16em;color:#2DD4BF;text-transform:uppercase}
  .copy{margin-top:56px;color:#D7E1F0;font-weight:500;font-size:40px;line-height:1.5;letter-spacing:.005em;max-width:1010px}
  .copy b{color:#5EEAD4;font-weight:700}
  .chips{margin-top:auto;display:flex;gap:16px}
  .chip{font-weight:600;font-size:23px;letter-spacing:.01em;padding:12px 22px;border-radius:9999px;color:#CFE6F0;white-space:nowrap}
  .c1{background:rgba(45,212,191,.14)}
  .c2{background:rgba(129,140,248,.16);color:#D7DBFB}
  .c3{background:rgba(52,211,153,.14);color:#CFEFDC}
  .c4{background:rgba(202,138,4,.18);color:#F0DEB0}
  .baseline{position:absolute;left:0;right:0;bottom:0;height:120px;opacity:.5}
</style></head><body>
  <div class="stage">
    <div class="lockup">
      ${MARK}
      <div class="word"><span class="name">Kizashi</span><span class="sub">AI-SRE</span></div>
    </div>
    <div class="copy">アラート発火後の<b>調査・評価・報告</b>を AI エージェントが肩代わり。既知は1秒未満で確定、未知は<b>証拠つきで原因</b>を提示 — 承認で学習し、次回から即時判定。</div>
    <div class="chips">
      <span class="chip c1">自動検知・分類</span>
      <span class="chip c2">マルチエージェントAI調査</span>
      <span class="chip c3">承認で学習・昇格</span>
      <span class="chip c4">リスク予兆</span>
    </div>
    <svg class="baseline" viewBox="0 0 1200 120" preserveAspectRatio="none">
      <polyline points="0,88 210,88 300,58 470,86 560,48 760,84 850,60 1040,80 1130,52 1200,52"
        fill="none" stroke="#2DD4BF" stroke-opacity="0.34" stroke-width="3"/>
    </svg>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: OUT });
await browser.close();
console.log(`✅ OG 画像出力: ${OUT}  (${W}×${H})`);
