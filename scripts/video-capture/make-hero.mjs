// ProtoPedia メイン画像（1920×1080）の候補生成。
// 現行 poster-1-hero.png は「UI 全画面スクショ＋左下にコピー」型で、一覧カード幅（約300px）に
// 縮むと上2/3が情報ゼロの暗色になる。決勝勢（AutoSRE/KangaL/DriftScribe）はいずれも
// 「巨大な1つの主張」型なので、同じ土俵で読める版を3案つくって選べるようにする。
//
// 使い方: node make-hero.mjs            → output/hero/hero-{a,b,c}.png と *-card.png（縮小検証用）
//        node make-hero.mjs a          → 案aだけ
// 前提: pnpm run setup 済み（chromium 取得済み）
//
// 採用は**案B**（docs/protopedia/assets/hero-brand.png）。案A は代替として
// hero-timeline.png に残してある。どちらも poster-1-hero.png とは名前を分けてある——
// あの名前は make-posters.mjs の出力なので、同名にすると向こうを流したとき戻る。
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "output/hero");
mkdirSync(OUT, { recursive: true });

// ブランドフォント（アプリ本体と同じ @fontsource セルフホスト実体）を data URI で焼き込む。
const FONT_DIR = resolve(
  HERE,
  "../../src/apps/backoffice/frontend/node_modules/@fontsource/ibm-plex-sans-jp/files",
);
const MONO_DIR = resolve(
  HERE,
  "../../src/apps/backoffice/frontend/node_modules/@fontsource/ibm-plex-mono/files",
);
const b64 = (p) => readFileSync(p).toString("base64");
const face = (family, dir, file, weight) =>
  `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;font-display:block;` +
  `src:url(data:font/woff2;base64,${b64(resolve(dir, file))}) format('woff2')}`;

const FONTS = [
  face("Plex", FONT_DIR, "ibm-plex-sans-jp-latin-400-normal.woff2", 400),
  face("Plex", FONT_DIR, "ibm-plex-sans-jp-latin-600-normal.woff2", 600),
  face("Plex", FONT_DIR, "ibm-plex-sans-jp-latin-700-normal.woff2", 700),
  face("PlexJP", FONT_DIR, "ibm-plex-sans-jp-japanese-400-normal.woff2", 400),
  face("PlexJP", FONT_DIR, "ibm-plex-sans-jp-japanese-600-normal.woff2", 600),
  face("PlexJP", FONT_DIR, "ibm-plex-sans-jp-japanese-700-normal.woff2", 700),
  face("PlexMono", MONO_DIR, "ibm-plex-mono-latin-400-normal.woff2", 400),
  face("PlexMono", MONO_DIR, "ibm-plex-mono-latin-600-normal.woff2", 600),
].join("\n");

// favicon.svg / BrandMark.tsx と同一意匠「次の一点」。座標は変更禁止（軌道の延長線上に点がある）。
const brandMark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="14" fill="#0c1626"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke="#94b4d4" stroke-opacity="0.25"/>
  <polyline points="14,45 27,45 36,32.4" stroke="#e6f4ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="46.5" cy="17.5" r="6" fill="#22d3ee"/>
</svg>`;

/**
 * ポスター寸法のアイコン版（案B用）。**幾何は favicon.svg と1座標も変えない**。
 *
 * ⚠ 一度タイルを外して字面だけを 560px で置いたが、**折れ線が家具（リクライニング
 * チェア）に見えて意匠が壊れた**。タイルは飾りではなく、字面を「グラフの軌跡」として
 * 読ませるための枠＝外すと参照枠を失う。よってタイルは戻し、代わりに**物体として作り込む**:
 * 面のグラデーション・上辺のリムライト・落ち影で、平面ではなく置かれたものにする。
 * 明るさは背後の cyan の光で作る（タイル自体を明るくすると意匠の色が変わるため）。
 */
const brandIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="tile" gradientUnits="objectBoundingBox" x1="0.1" y1="0" x2="0.75" y2="1">
      <stop offset="0" stop-color="#1c3f5e"/>
      <stop offset=".5" stop-color="#102639"/>
      <stop offset="1" stop-color="#091524"/>
    </linearGradient>
    <linearGradient id="rim" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dcefff" stop-opacity=".42"/>
      <stop offset=".35" stop-color="#dcefff" stop-opacity=".06"/>
      <stop offset="1" stop-color="#dcefff" stop-opacity="0"/>
    </linearGradient>
    <filter id="dotbloom" x="-300%" y="-300%" width="700%" height="700%">
      <feGaussianBlur stdDeviation="3.2"/>
    </filter>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#tile)"/>
  <rect x="0.7" y="0.7" width="62.6" height="62.6" rx="13.3" fill="none" stroke="url(#rim)" stroke-width="1.4"/>
  <polyline points="14,45 27,45 36,32.4" stroke="#eef6ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="46.5" cy="17.5" r="6" fill="#22d3ee" filter="url(#dotbloom)" opacity=".9"/>
  <circle cx="46.5" cy="17.5" r="6" fill="#3fdcf5"/>
</svg>`;

const wordmark = (markSize, nameSize) => `
<div class="brandbar">
  ${brandMark(markSize)}
  <div class="name">Kizashi<span class="jp">兆し</span></div>
  <div class="tag">AI-SRE AGENT</div>
</div>`;

const SHELL = (body, extraCss = "") => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:#070d18}
.stage{position:relative;width:1920px;height:1080px;
  font-family:'Plex','PlexJP',sans-serif;color:#e2e8f0;
  background:
    radial-gradient(1100px 700px at 78% 18%, rgba(34,211,238,.16), transparent 62%),
    radial-gradient(900px 620px at 12% 86%, rgba(56,189,248,.10), transparent 60%),
    linear-gradient(155deg,#0d1a2e 0%,#0a1526 45%,#070d18 100%)}
.grid{position:absolute;inset:0;opacity:.5;
  background-image:linear-gradient(rgba(148,180,212,.055) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(148,180,212,.055) 1px,transparent 1px);
  background-size:64px 64px}
.brandbar{position:absolute;display:flex;align-items:center;gap:20px}
.brandbar .name{font-weight:700;letter-spacing:-.01em;color:#f8fafc;line-height:1;display:flex;align-items:baseline;gap:14px}
.brandbar .name .jp{font-family:'PlexJP',sans-serif;font-weight:600;color:#7dd3fc;letter-spacing:.06em}
.brandbar .tag{font-family:'PlexMono',monospace;font-weight:600;letter-spacing:.22em;color:#7c93ad;
  border-left:1px solid rgba(148,180,212,.3);padding-left:20px}
.jpx{font-family:'PlexJP',sans-serif}
.chips{position:absolute;display:flex;gap:16px}
.chip{display:flex;align-items:center;gap:12px;font-family:'PlexJP',sans-serif;font-weight:600;
  background:rgba(148,180,212,.09);border:1px solid rgba(148,180,212,.22);border-radius:12px;
  padding:16px 22px;font-size:27px;color:#cbd5e1;white-space:nowrap}
.chip b{color:#f1f5f9;font-weight:700}
.chip i{width:9px;height:9px;border-radius:50%;background:#22d3ee;font-style:normal;flex:0 0 auto;
  box-shadow:0 0 12px rgba(34,211,238,.8)}
${extraCss}
</style></head><body><div class="stage"><div class="grid"></div>
${body}
</div></body></html>`;

/* ── 案A「時間軸」──────────────────────────────────────────────────────────
 * 図はブランドマーク「次の一点」の拡大そのもの: 実線が伸び、途切れた延長線上に点がある。
 * 折れ線の座標は favicon.svg と同じ関係（点は必ず立ち上がりの延長線上・目分量で置かない）。
 *
 * 配色は製品の時間軸（features/forecast/.../ForecastTimeline.tsx）から借りる＝新しい色を
 * 持ち込まない: 人が動ける区間＝cyan（先手ブロックと同軸）／発生窓＝amber（スケジュール
 * lane と同軸）／起点＝白丸。level 文言は riskLevelLabel に揃える——UI から「HIGH」は
 * 消えており（RiskCard.tsx: 同じ level を2語で言っていたため削除）、画面にあるのは
 * 「高リスク」だけ。確信度%は製品が意図して出していないので、ここにも出さない。
 * 装飾（背景グリッド・多重グロー・見出しの影）は意味を持たないので全部落とす。
 * ────────────────────────────────────────────────────────────────────── */
const A = SHELL(
  `
${wordmark(60, 0)}
<h1 class="head jpx">障害は、起きる前に終わらせる</h1>
<p class="sub jpx">未来の変更・負荷予定・過去の同型事例を突合し、<b>いま打てる先手</b>まで根拠付きで出す。</p>

<svg class="tl" width="1920" height="520" viewBox="0 0 1920 520">
  <defs>
    <linearGradient id="past" gradientUnits="userSpaceOnUse" x1="120" y1="0" x2="760" y2="0">
      <stop offset="0" stop-color="#e6f4ff" stop-opacity="0"/>
      <stop offset=".3" stop-color="#e6f4ff" stop-opacity=".72"/>
      <stop offset="1" stop-color="#e6f4ff" stop-opacity=".92"/>
    </linearGradient>
    <radialGradient id="halo">
      <stop offset="0" stop-color="#fbbf24" stop-opacity=".3"/>
      <stop offset=".5" stop-color="#fbbf24" stop-opacity=".1"/>
      <stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- 観測済み（過去）。左端はフェードで「ここから始まった」を主張しない。 -->
  <path d="M120 330 H760" stroke="url(#past)" stroke-width="10" stroke-linecap="round" fill="none"/>
  <!-- いま＝白い起点。製品の軸の左端マーカーと同じ。 -->
  <circle cx="760" cy="330" r="9" fill="#f8fafc"/>
  <!-- 人が動ける区間。実測由来なのでベタ塗り（宣言値なら破線にする規律の裏返し）。 -->
  <path d="M760 330 L1560 150" stroke="#22d3ee" stroke-width="10" stroke-linecap="round" fill="none"/>
  <!-- 予測発生。立ち上がりの延長線上（傾き -0.225）に置く＝マークと同じ幾何。 -->
  <circle cx="1640" cy="132" r="66" fill="url(#halo)"/>
  <circle cx="1640" cy="132" r="21" fill="#fbbf24"/>
  <!-- 判断に使える時間の寸法線。 -->
  <path d="M760 348 V400 M1560 168 V400" stroke="#22d3ee" stroke-opacity=".2" stroke-width="2" stroke-dasharray="4 9"/>
  <path d="M760 400 V418 M760 418 H1560 M1560 418 V400" stroke="#22d3ee" stroke-opacity=".42" stroke-width="2" fill="none"/>
</svg>

<div class="lbl now jpx">いま</div>
<div class="lbl target jpx">
  <div class="t1"><span class="pill">高リスク</span>DB接続プール枯渇</div>
  <div class="t2">予測発生　土 20:00–23:00</div>
</div>
<div class="lbl span jpx">
  <div class="s1">判断に使える時間　81時間2分</div>
  <div class="s2">対処の所要 30分（宣言値）を差し引いた値</div>
</div>

<div class="facts jpx">
  <span>引用は<b>実在シグナルと照合済み</b></span>
  <span>未知は<b>8つのAIエージェント</b>が自律調査</span>
  <span>既知は<b>1秒・AIコストゼロ</b></span>
</div>
`,
  `
.grid{display:none}
.stage{background:
  radial-gradient(760px 520px at 88% 50%, rgba(251,191,36,.06), transparent 66%),
  radial-gradient(880px 600px at 20% 76%, rgba(34,211,238,.06), transparent 62%),
  linear-gradient(180deg,#0c1727 0%,#08111f 56%,#060c17 100%)}
.brandbar{left:120px;top:68px;gap:18px}
.brandbar .name{font-size:42px}
.brandbar .name .jp{font-size:26px}
.brandbar .tag{font-size:17px;padding-left:18px}
.head{position:absolute;left:120px;top:160px;font-size:112px;font-weight:700;color:#f5f8fc;
  line-height:1;letter-spacing:0}
.sub{position:absolute;left:120px;top:312px;font-size:34px;font-weight:400;color:#93a8bf;letter-spacing:.01em}
.sub b{color:#dbe6f2;font-weight:600}
.tl{position:absolute;left:0;top:420px}
.lbl{position:absolute;line-height:1.34}
.lbl.now{left:760px;top:684px;transform:translateX(-50%);font-size:28px;font-weight:600;color:#8ca3bb}
.lbl.target{right:120px;top:392px;text-align:right}
.lbl.target .t1{font-size:36px;font-weight:700;color:#f1f5f9;display:flex;align-items:center;
  justify-content:flex-end;gap:14px;white-space:nowrap}
.lbl.target .t2{margin-top:10px;font-size:28px;font-weight:600;color:#fcd34d;white-space:nowrap}
.pill{font-size:23px;font-weight:700;color:#fda4af;background:rgba(244,63,94,.16);
  border-radius:8px;padding:5px 13px;line-height:1.2}
.lbl.span{left:1160px;top:858px;transform:translateX(-50%);text-align:center;white-space:nowrap}
.lbl.span .s1{font-size:31px;font-weight:600;color:#67e8f9}
.lbl.span .s2{margin-top:7px;font-size:22px;font-weight:400;color:#7c93ad}
.facts{position:absolute;left:120px;bottom:80px;display:flex;align-items:center;
  font-size:26px;font-weight:400;color:#93a8bf;white-space:nowrap}
.facts span{padding:0 28px;border-left:1px solid rgba(148,180,212,.26)}
.facts span:first-child{padding-left:0;border-left:none}
.facts b{color:#dbe6f2;font-weight:600}
`,
);

/* ── 案B「ブランド」──────────────────────────────────────────────────────────
 * KangaL / DriftScribe と同型（巨大なマーク＋巨大な名前＋1行）。この型が効くのは
 * **明るい塊が画面にあるから**で、両者とも白い図像 or 青いタイルで面を取っている。
 * 初版はタイル付きマークを置いたため「暗い正方形」になって沈んだ＝タイルを外し、
 * 字面そのものを 560px の図像として使う（`brandGlyph`）。cyan の点は画面唯一の
 * 光源として扱い、背景のグラデーションもその点を中心に組む。
 *
 * 数字は「判断に使える時間」を1つだけ。予報の confidence は未較正で製品も画面に
 * 出していないので、ここにも出さない（案A と同じ規律）。
 * ────────────────────────────────────────────────────────────────────── */
const B = SHELL(
  `
<div class="bloom"></div>
<div class="iconwrap">${brandIcon(300)}</div>
<div class="nm"><span class="en">Kizashi</span><span class="jp">兆し</span></div>
<div class="copy jpx">障害は、起きる前に終わらせる</div>
<div class="eyebrow-b">BUILT ON GOOGLE CLOUD · ADK · GEMINI</div>
<div class="rule-b"></div>
<div class="spec">
  <div><span class="k jpx">根拠</span><span class="v jpx"><b>照合できない引用は、表示しない</b></span></div>
  <div><span class="k jpx">判断</span><span class="v jpx">調べて提案するのはAI、<b>決めるのは人</b></span></div>
  <div><span class="k jpx">導入</span><span class="v jpx">既存の監視基盤を<b>置き換えない</b></span></div>
</div>
`,
  `
.grid{display:none}
.stage{background:
  radial-gradient(1400px 950px at 84% 88%, rgba(29,78,216,.22), transparent 62%),
  radial-gradient(1000px 700px at 72% 2%, rgba(56,189,248,.11), transparent 62%),
  linear-gradient(158deg,#13293f 0%,#0b1c30 46%,#060d19 100%)}
.stage::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(122% 92% at 44% 46%, transparent 52%, rgba(3,7,14,.5) 100%)}
/* アイコンの背後に光を置き、暗い物体をシルエットとして立てる。 */
.bloom{position:absolute;left:310px;top:380px;width:860px;height:860px;transform:translate(-50%,-50%);
  border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(34,211,238,.26) 0%,rgba(34,211,238,.085) 36%,transparent 66%)}
/* 参照した2本（DriftScribe / KangaL）はワードマークが主役でアイコンは伴奏。
   初版はその比が逆で、アイコンショーケースになっていた。 */
.iconwrap{position:absolute;left:160px;top:230px;filter:drop-shadow(0 40px 72px rgba(2,7,14,.72))}
.nm{position:absolute;left:540px;top:264px;font-size:232px;font-weight:700;line-height:1;
  letter-spacing:-.024em;display:flex;align-items:baseline;gap:34px}
.nm .en{background:linear-gradient(176deg,#ffffff 8%,#b2cde3 96%);-webkit-background-clip:text;
  background-clip:text;color:transparent}
.nm .jp{font-family:'PlexJP',sans-serif;font-size:96px;font-weight:600;color:#7dd3fc;letter-spacing:.08em}
.copy{position:absolute;left:160px;top:636px;font-size:100px;font-weight:700;color:#f4f8fc;
  letter-spacing:.005em;line-height:1.15}
/* 下辺の帯。ここが無いと画面の下 1/4 が空洞になり、重心が上に寄ったまま終わる。 */
.eyebrow-b{position:absolute;right:150px;top:812px;font-family:'PlexMono',monospace;
  font-size:18px;font-weight:600;letter-spacing:.2em;color:#5f7b96}
.rule-b{position:absolute;left:160px;right:150px;top:872px;height:1px;
  background:linear-gradient(90deg,rgba(148,180,212,.34),rgba(148,180,212,.05))}
.spec{position:absolute;left:160px;right:150px;top:906px;display:grid;grid-template-columns:repeat(3,1fr)}
.spec > div{display:flex;flex-direction:column;gap:10px;padding-right:40px}
.spec .k{font-size:19px;font-weight:700;letter-spacing:.24em;color:#4fc9e0}
.spec .v{font-size:27px;font-weight:400;color:#a3b8cf;white-space:nowrap}
.spec .v b{color:#eaf2fa;font-weight:600}
`,
);

/* ── 案C「起きる前 / 起きた後」: 製品の守備範囲そのものを二分割で見せる ── */
const C = SHELL(
  `
${wordmark(66, 0)}
<div class="split">
  <div class="half before">
    <div class="phase jpx">起きる前</div>
    <div class="big jpx">予<span>報</span></div>
    <div class="desc jpx">未来の変更・負荷予定・過去の同型事例を突合し、<b>いま打てる先手</b>を根拠付きで出す。</div>
    <div class="tags"><span class="jpx">根拠3種類</span><span class="jpx">確信度つき</span><span class="jpx">引用は実在照合済み</span></div>
  </div>
  <div class="vr"></div>
  <div class="half after">
    <div class="phase jpx">起きた後</div>
    <div class="big jpx">自律調査</div>
    <div class="desc jpx"><b>8つのAIエージェント</b>がログ・コード差分・インフラ差分を横断し、根拠リンク付きで報告。</div>
    <div class="tags"><span class="jpx">人が承認して学習</span><span class="jpx">既知は1秒・AIコストゼロ</span></div>
  </div>
</div>
<div class="hr"></div>
<div class="foot jpx">障害は、起きる前に終わらせる</div>
<div class="footnote jpx">既存の監視基盤の<b>上に乗る</b>／Google Cloud・ADK・Gemini</div>
`,
  `
.brandbar{left:104px;top:68px}
.brandbar .name{font-size:52px}
.brandbar .tag{font-size:19px}
.split{position:absolute;left:104px;right:104px;top:210px;display:flex;align-items:stretch;gap:0}
.half{flex:1 1 0;padding:0 66px}
.half.before{padding-left:0}
.half.after{padding-right:0}
.vr{width:1px;background:linear-gradient(180deg,transparent,rgba(148,180,212,.42) 14%,rgba(148,180,212,.42) 86%,transparent)}
.phase{font-size:34px;font-weight:700;letter-spacing:.24em;color:#7c93ad}
.before .phase{color:#67e8f9}
.big{font-size:166px;font-weight:700;line-height:1.05;margin-top:22px;letter-spacing:.04em;color:#f8fafc}
.before .big{color:#22d3ee;text-shadow:0 0 60px rgba(34,211,238,.45)}
.desc{margin-top:46px;font-size:32px;font-weight:400;line-height:1.7;color:#a9bdd3;max-width:720px}
.desc b{color:#e2e8f0;font-weight:600}
.tags{margin-top:44px;display:flex;flex-wrap:wrap;gap:12px}
.tags span{font-size:24px;font-weight:600;color:#cbd5e1;background:rgba(148,180,212,.09);
  border:1px solid rgba(148,180,212,.22);border-radius:10px;padding:11px 18px}
.hr{position:absolute;left:104px;right:104px;top:846px;height:1px;
  background:linear-gradient(90deg,rgba(148,180,212,.34),rgba(148,180,212,.04))}
.foot{position:absolute;left:104px;top:908px;font-size:62px;font-weight:700;color:#f1f5f9;letter-spacing:.01em}
.foot::before{content:"";position:absolute;left:-28px;top:8px;width:9px;height:64px;border-radius:5px;
  background:linear-gradient(#22d3ee,#0ea5e9);box-shadow:0 0 22px rgba(34,211,238,.6)}
.footnote{position:absolute;right:104px;top:938px;font-size:26px;font-weight:400;color:#7c93ad;text-align:right}
.footnote b{color:#a9bdd3;font-weight:600}
`,
);

const VARIANTS = { a: A, b: B, c: C };
const pick = process.argv[2];
const targets = pick ? [[pick, VARIANTS[pick]]] : Object.entries(VARIANTS);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
for (const [key, htmlDoc] of targets) {
  if (!htmlDoc) throw new Error(`unknown variant: ${key}`);
  await page.setContent(htmlDoc, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(OUT, `hero-${key}.png`), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log(`  🖼  hero-${key}.png`);
}
// 一覧カード相当（幅320px）に縮めた検証用。ここで読めないものは ProtoPedia の一覧でも読めない。
await page.setViewportSize({ width: 320, height: 180 });
for (const [key, htmlDoc] of targets) {
  await page.setContent(
    `<!doctype html><body style="margin:0"><img src="data:image/png;base64,${b64(
      resolve(OUT, `hero-${key}.png`),
    )}" style="width:320px;height:180px;display:block">`,
    { waitUntil: "load" },
  );
  await page.screenshot({ path: resolve(OUT, `hero-${key}-card.png`), clip: { x: 0, y: 0, width: 320, height: 180 } });
  console.log(`  🔍 hero-${key}-card.png（一覧サイズ検証）`);
}
await browser.close();
console.log("✅ 候補生成完了 → scripts/video-capture/output/hero/");
