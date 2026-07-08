// 撮影ツール共通ヘルパ。
// - ブラウザ/コンテキスト生成（recordVideo・偽カーソル注入・尺の間合い）
// - backoffice API 駆動（e2e/backoffice/support.ts と同じ作法。ここは録画専用なので依存させず再実装）
import { chromium } from "playwright";
import { mkdir, rename, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

export const FRONT_URL = process.env.FRONT_URL ?? "http://localhost:5173";
export const API_URL = process.env.API_URL ?? "http://localhost:3001";

const OUTPUT_DIR = new URL("./output/", import.meta.url).pathname;

// テイク管理: 実行（プロセス）ごとに output/takeNNN/ を1つ切り、パート webm とスクショを
// その下にまとめる。番号は既存の最大+1 を自動採番。特定シーンだけ撮り直して既存テイクに
// 追記したいときは TAKE=take003 のように明示する（同名パートは上書き）。
let takeDirCache;
export async function takeDir() {
  takeDirCache ??= (async () => {
    await mkdir(OUTPUT_DIR, { recursive: true });
    let name = process.env.TAKE;
    if (!name) {
      const entries = await readdir(OUTPUT_DIR).catch(() => []);
      const nums = entries
        .map((n) => /^take(\d{3})$/.exec(n)?.[1])
        .filter(Boolean)
        .map(Number);
      name = `take${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
    }
    const dir = path.join(OUTPUT_DIR, name);
    await mkdir(dir, { recursive: true });
    return dir;
  })();
  return takeDirCache;
}

// 間合いのグローバル倍率（1=台本想定・リハで長めに撮るなら DWELL_SCALE=1.5 など）
const DWELL_SCALE = Number(process.env.DWELL_SCALE ?? "1");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const dwell = (ms) => sleep(ms * DWELL_SCALE);

// ---------------------------------------------------------------------------
// mp4 変換（編集ソフト互換のため）
// ---------------------------------------------------------------------------
// Playwright の録画は VP8 in webm 固定で、DaVinci / Premiere / CapCut 等の多くは
// これを読めない（＝「壊れてる」ように見える）。撮影後に H.264 mp4 へ変換して
// パート本体として出す。ロスレスな webm 源は .raw/ に温存（再変換用）。
//
// ffmpeg の解決順: FFMPEG_PATH → ffmpeg-static（pnpm run setup で入る・root不要）
// → PATH 上の ffmpeg。いずれも無ければ変換をスキップし webm のまま出す（撮影は止めない）。
let ffmpegPathCache;
async function resolveFfmpeg() {
  if (ffmpegPathCache !== undefined) return ffmpegPathCache;
  if (process.env.FFMPEG_PATH) return (ffmpegPathCache = process.env.FFMPEG_PATH);
  try {
    const mod = await import("ffmpeg-static");
    if (mod?.default) return (ffmpegPathCache = mod.default);
  } catch {
    /* 未インストール → 次の候補へ */
  }
  return (ffmpegPathCache = "ffmpeg"); // PATH 上を期待
}

/**
 * webm → H.264 mp4。画面録画なのでテキストが潰れないよう CRF は低め、
 * yuv420p + faststart + CFR30 で編集・配信の互換を最優先。成否を boolean で返す。
 */
async function transcodeToMp4(src, dest) {
  const ffmpeg = await resolveFfmpeg();
  const args = [
    "-y", "-i", src,
    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
    "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart",
    dest,
  ];
  return await new Promise((resolve) => {
    const p = spawn(ffmpeg, args, { stdio: "ignore" });
    p.on("error", () => resolve(false)); // バイナリ無し等
    p.on("close", (code) => resolve(code === 0));
  });
}

// ---------------------------------------------------------------------------
// ブラウザ側
// ---------------------------------------------------------------------------

// クリック位置が動画で追えるよう、マウスに追従する偽カーソル（水色ドット）を全ページに注入する。
// mousedown で一瞬膨らませてクリックを可視化する。UI 本体には一切手を入れない。
const FAKE_CURSOR_INIT = `
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText = [
      "position:fixed", "z-index:2147483647", "pointer-events:none",
      "width:18px", "height:18px", "border-radius:50%",
      "background:rgba(34,211,238,.55)", "border:2px solid rgba(34,211,238,.9)",
      "transform:translate(-50%,-50%)", "transition:width .1s,height .1s",
      "left:-100px", "top:-100px",
    ].join(";");
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => { c.style.width = "28px"; c.style.height = "28px"; }, true);
    addEventListener("mouseup", () => { c.style.width = "18px"; c.style.height = "18px"; }, true);
  });
`;

/**
 * 1シーン=1コンテキスト=1パート（webm）。close 時に output/takeNNN/<part>.webm へリネームする。
 * 外部リンク（GitHub 等）の popup ページも同コンテキストで録画される（別 webm）。
 * @param partName 例 "part1-forecast"（テイク内のファイル/スクショディレクトリ名になる）
 */
export async function openStage(partName) {
  const take = await takeDir();
  const rawVideoDir = path.join(take, ".raw");
  const screenDir = path.join(take, "screens", partName);
  await mkdir(rawVideoDir, { recursive: true });
  await mkdir(screenDir, { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.HEADED !== "1",
    // 操作間に最低限の人間らしい間を入れる（細かい間合いは各シーンの dwell で作る）
    slowMo: Number(process.env.SLOWMO ?? "150"),
    // 白飛び対策(1/2): サイト分離を無効化し、localhost→github.com のクロスオリジン遷移でも
    // レンダラのプロセス差し替えを避ける。差し替えが起きないと Chromium の paint-holding が
    // 前フレームを保持したまま遷移先を描画→切替できるため、遷移中の空白フレーム自体が出ない。
    args: [
      "--disable-site-isolation-trials",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: rawVideoDir, size: { width: 1920, height: 1080 } },
    // GitHub 側もダーク統一（カット6/8 の映り込み対策）
    colorScheme: "dark",
    locale: "ja-JP",
  });
  await context.addInitScript(FAKE_CURSOR_INIT);

  const page = await context.newPage();
  // 白飛び対策(2/2): プロセス差し替えが残った場合の保険。遷移中にコンポジタが描く
  // デフォルトの base background（白）をアプリ背景色 #0b0e14 に上書きし、白フレームを
  // ダークに寄せる。paint-holding が効けばそもそも空白は出ないが、効かなかったときの色ズレを消す。
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", {
      color: { r: 11, g: 14, b: 20, a: 1 },
    });
  } catch {
    // CDP 非対応環境でも撮影は続行（白飛び対策(1)のみで運用）。
  }
  let shotIndex = 0;

  return {
    context,
    page,
    /** 現在表示中のページのスクショを output/takeNNN/screens/<part>/NN-<label>.png に保存 */
    async shot(label, target = page) {
      shotIndex += 1;
      const file = path.join(
        screenDir,
        `${String(shotIndex).padStart(2, "0")}-${label}.png`,
      );
      await target.screenshot({ path: file });
      console.log(`  📸 ${path.relative(OUTPUT_DIR, file)}`);
    },
    /**
     * パート終了。各録画（本体＋外部タブ popup）を H.264 mp4 に変換して保存先を返す。
     * ロスレス源の webm は .raw/ に残す（再変換用）。ffmpeg が無い環境では変換を
     * スキップし、従来どおり webm をパート名にリネームして出す（撮影は止めない）。
     */
    async close() {
      const videos = context.pages().map((p) => p.video()).filter(Boolean);
      await context.close(); // ここで .raw/*.webm が確定する
      const saved = [];
      for (const [i, video] of videos.entries()) {
        const raw = await video.path(); // .raw/ 内のパス（ロスレス源として温存）
        const base = i === 0 ? partName : `${partName}-popup${i}`;
        const mp4 = path.join(take, `${base}.mp4`);
        if (await transcodeToMp4(raw, mp4)) {
          saved.push(mp4);
          console.log(`  🎞  ${path.relative(OUTPUT_DIR, mp4)}  (源: .raw/${path.basename(raw)})`);
        } else {
          const webm = path.join(take, `${base}.webm`);
          await rename(raw, webm);
          saved.push(webm);
          console.warn(`  🎞  ${path.relative(OUTPUT_DIR, webm)}  ⚠ mp4 変換 skip（ffmpeg 未検出: pnpm run setup / FFMPEG_PATH を確認）`);
        }
      }
      await browser.close();
      return saved;
    },
  };
}

// ---------------------------------------------------------------------------
// backoffice API 駆動（シナリオ発火・Alert 待ち）
// ---------------------------------------------------------------------------

async function api(pathname, init) {
  const res = await fetch(`${API_URL}${pathname}`, init);
  if (!res.ok && res.status !== 202) {
    throw new Error(`${init?.method ?? "GET"} ${pathname} -> ${res.status} ${await res.text()}`);
  }
  return res;
}

/** demo データを seed 初期状態へ戻す（make reset と同じ経路）。予報キャッシュは消さない。 */
export async function resetDemo() {
  const res = await api("/demo/reset", { method: "POST" });
  return res.json();
}

/** デモシナリオ発火（"1"|"2"|"3"|"3b"|"4"）。202 応答。 */
export async function triggerScenario(scenarioId) {
  const res = await api(`/demo/scenario/${scenarioId}/trigger`, { method: "POST" });
  return res.json();
}

export async function fetchAlerts() {
  const res = await api("/alerts");
  const body = await res.json();
  return body.alerts;
}

/** 現在の Alert id 集合。トリガー前に取り「新顔」を特定するのに使う */
export async function snapshotAlertIds() {
  return new Set((await fetchAlerts()).map((a) => a.id));
}

/** 述語を満たす Alert が現れるまで /alerts をポーリング */
export async function waitForAlert(predicate, { timeoutMs = 90_000, intervalMs = 1_000, label = "alert" } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = (await fetchAlerts().catch(() => [])).find(predicate);
    if (hit) return hit;
    await sleep(intervalMs);
  }
  throw new Error(`waitForAlert(${label}): ${timeoutMs}ms 以内に現れませんでした`);
}

/** 指定 Alert の調査レポート完成（investigationReport 非 null）まで待つ。実 Gemini は約2分想定 */
export async function waitForReport(alertId, { timeoutMs = 300_000, intervalMs = 2_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${API_URL}/alerts/${alertId}`);
    if (res.ok) {
      const alert = await res.json();
      if (alert.investigationReport) return alert;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Alert ${alertId} の調査が ${timeoutMs}ms 以内に完了しませんでした`);
}
