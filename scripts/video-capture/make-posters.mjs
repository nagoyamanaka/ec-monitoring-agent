// ProtoPedia 紹介画像のポスター化。take003 のスクショに下辺グラデ帯＋1行コピーを焼き込み、
// 1920×1080 のダークポスター PNG を docs/protopedia/assets/ へ出力する。
// 使い方: node make-posters.mjs   （前提: pnpm run setup 済み＝chromium 取得済み）
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(HERE, "../../docs/protopedia/assets");
// 素材の既定テイク（part2/part3 は Option B の影響外＝据置）。poster ごとに take で上書きできる。
const BASE_TAKE = process.env.TAKE ?? "take003";
const screensDir = (take) => resolve(HERE, `output/${take}/screens`);

// #（Hero を除く連番）, 元スクショ, 焼き込みコピー, 出力名, take（省略時は BASE_TAKE）
const POSTERS = [
  // Hero は最新テイク（U1 収束フロー＋U2 の予報2枚）から＝BASE_TAKE（TAKE env）に追従。
  // U7: take004 のハードコードを撤去し、TAKE=take005 で hero も take005 に更新されるようにした。
  { n: 1, src: "part1-forecast/01-forecast-card.png", copy: "障害は、起きる前に終わらせる。", out: "poster-1-hero.png", hero: true },
  { n: 3, src: "part2-investigation/03-live-timeline.png", copy: "8つのAIエージェントが、ライブで調査する。", out: "poster-3-live-agents.png" },
  { n: 4, src: "part2-investigation/06-evidence-panel.png", copy: "結論には、実在する証拠だけ。", out: "poster-4-evidence.png" },
  { n: 5, src: "part3-learning/01-known-instant.png", copy: "二度目の同じ障害は、1秒で終わる。", out: "poster-5-known.png" },
];

const dataUri = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;

function html(bgUri, copy, hero) {
  // Hero はコピーを一段大きく。帯は下から立ち上がるグラデ（コンテンツを隠さない）。
  const copySize = hero ? 76 : 60;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1920px;height:1080px;overflow:hidden}
  .stage{position:relative;width:1920px;height:1080px;background:#0B1220}
  .shot{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover}
  .band{position:absolute;left:0;right:0;bottom:0;height:340px;
        background:linear-gradient(to top,#0B1220 0%,rgba(11,18,32,.94) 34%,rgba(11,18,32,.72) 62%,rgba(11,18,32,0) 100%)}
  .copywrap{position:absolute;left:96px;bottom:88px;display:flex;align-items:center;gap:28px;max-width:1728px}
  .accent{flex:0 0 auto;width:10px;height:${copySize + 18}px;border-radius:6px;
          background:linear-gradient(#2DD4BF,#14B8A6);box-shadow:0 0 24px rgba(45,212,191,.45)}
  .copy{font-family:"Noto Sans CJK JP",sans-serif;font-weight:700;color:#F2F6FC;
        font-size:${copySize}px;line-height:1.18;letter-spacing:.01em;
        text-shadow:0 2px 18px rgba(0,0,0,.55)}
  .brand{position:absolute;left:100px;bottom:${88 + copySize + 34}px;
         font-family:"Noto Sans CJK JP",sans-serif;font-weight:700;font-size:26px;letter-spacing:.14em;
         color:#2DD4BF;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.6)}
  .brand small{color:#8FA3BF;font-weight:600;letter-spacing:.08em;margin-left:12px;text-transform:none}
  </style></head><body>
  <div class="stage">
    <img class="shot" src="${bgUri}"/>
    <div class="band"></div>
    <div class="brand">Kizashi<small>AI-SRE</small></div>
    <div class="copywrap"><div class="accent"></div><div class="copy">${copy}</div></div>
  </div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
for (const p of POSTERS) {
  const src = resolve(screensDir(p.take ?? BASE_TAKE), p.src);
  await page.setContent(html(dataUri(src), p.copy, p.hero), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const outPath = resolve(ASSETS, p.out);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log(`  🖼  ${p.out}  ← ${p.src}`);
}
await browser.close();
console.log("✅ ポスター生成完了");
