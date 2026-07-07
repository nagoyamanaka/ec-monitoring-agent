// 動画サムネイル（YouTube 用 1280×720）。予報カードのクローズアップに拡大し、
// 左上に Kizashi ワードマーク・下部に1行コピーを焼き込む。B2 の make-posters.mjs と同機構。
// 使い方: node make-thumbnail.mjs   （前提: pnpm run setup 済み＝chromium 取得済み）
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "output/take003/screens/part1-forecast/01-forecast-card.png");
const OUT = resolve(HERE, "../../docs/protopedia/assets/video-thumbnail.png");

const W = 1280, H = 720;
// 元スクショ(1920×1080)のうち、予報カード見出し〜今打てる先手を含む領域を切り出して拡大。
// crop 領域: 左上(CX,CY)・幅CW・高さCH（アスペクトは 16:9 に合わせる）。
const CX = 445, CY = 232, CW = 668;
const CH = Math.round((CW * H) / W); // 16:9 維持
const scale = W / CW;

const bgUri = `data:image/png;base64,${readFileSync(SRC).toString("base64")}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#0B1220}
.stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#0B1220}
.zoom{position:absolute;top:0;left:0;width:1920px;height:1080px;
      transform-origin:0 0;transform:scale(${scale}) translate(${-CX}px,${-CY}px);
      image-rendering:auto}
/* 上下に軽いダークグラデで文字の可読性を担保（カード面は素通し） */
.veil{position:absolute;inset:0;background:
   linear-gradient(to bottom,rgba(11,18,32,.55) 0%,rgba(11,18,32,0) 22%,rgba(11,18,32,0) 55%,rgba(11,18,32,.92) 100%)}
.brand{position:absolute;top:30px;left:40px;display:flex;align-items:center;gap:13px;
       font-family:"Noto Sans CJK JP",sans-serif;z-index:3;
       padding:12px 20px 12px 18px;border-radius:14px;
       background:rgba(9,15,28,.82);border:1px solid rgba(45,212,191,.28);
       box-shadow:0 8px 28px rgba(0,0,0,.45)}
.brand .dot{width:20px;height:20px;border-radius:6px;background:linear-gradient(#2DD4BF,#14B8A6);
       box-shadow:0 0 18px rgba(45,212,191,.6)}
.brand .name{font-weight:700;font-size:34px;letter-spacing:.02em;color:#F2F6FC;text-shadow:0 2px 12px rgba(0,0,0,.7)}
.brand .sub{font-weight:700;font-size:18px;letter-spacing:.14em;color:#2DD4BF;text-transform:uppercase}
.copywrap{position:absolute;left:44px;bottom:46px;display:flex;align-items:center;gap:20px;
          max-width:${W - 88}px;z-index:3}
.accent{flex:0 0 auto;width:9px;height:74px;border-radius:6px;background:linear-gradient(#2DD4BF,#14B8A6);
        box-shadow:0 0 22px rgba(45,212,191,.5)}
.copy{font-family:"Noto Sans CJK JP",sans-serif;font-weight:700;color:#F2F6FC;
      font-size:62px;line-height:1.14;letter-spacing:.01em;text-shadow:0 3px 20px rgba(0,0,0,.7)}
</style></head><body>
<div class="stage">
  <img class="zoom" src="${bgUri}"/>
  <div class="veil"></div>
  <div class="brand"><span class="dot"></span><span class="name">Kizashi</span><span class="sub">AI-SRE</span></div>
  <div class="copywrap"><div class="accent"></div><div class="copy">障害は、起きる前に終わらせる。</div></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H } });
await browser.close();
console.log(`✅ サムネイル出力: ${OUT}  (crop ${CW}x${CH} → ${W}x${H}, scale ${scale.toFixed(2)}x)`);
