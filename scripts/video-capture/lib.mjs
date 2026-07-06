// 撮影ツール共通ヘルパ。
// - ブラウザ/コンテキスト生成（recordVideo・偽カーソル注入・尺の間合い）
// - backoffice API 駆動（e2e/backoffice/support.ts と同じ作法。ここは録画専用なので依存させず再実装）
import { chromium } from "playwright";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

export const FRONT_URL = process.env.FRONT_URL ?? "http://localhost:5173";
export const API_URL = process.env.API_URL ?? "http://localhost:3001";

const OUTPUT_DIR = new URL("./output/", import.meta.url).pathname;
const VIDEO_DIR = path.join(OUTPUT_DIR, "video");
const SCREEN_DIR = path.join(OUTPUT_DIR, "screens");

// 間合いのグローバル倍率（1=台本想定・リハで長めに撮るなら DWELL_SCALE=1.5 など）
const DWELL_SCALE = Number(process.env.DWELL_SCALE ?? "1");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const dwell = (ms) => sleep(ms * DWELL_SCALE);

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
 * 1シーン=1コンテキスト=1テイク（webm）。close 時に output/video/<scene>.webm へリネームする。
 * 外部リンク（GitHub 等）の popup ページも同コンテキストで録画される（別 webm）。
 */
export async function openStage(sceneName) {
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(path.join(SCREEN_DIR, sceneName), { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.HEADED !== "1",
    // 操作間に最低限の人間らしい間を入れる（細かい間合いは各シーンの dwell で作る）
    slowMo: Number(process.env.SLOWMO ?? "150"),
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1920, height: 1080 } },
    // GitHub 側もダーク統一（カット6/8 の映り込み対策）
    colorScheme: "dark",
    locale: "ja-JP",
  });
  await context.addInitScript(FAKE_CURSOR_INIT);

  const page = await context.newPage();
  let shotIndex = 0;

  return {
    context,
    page,
    /** 現在表示中のページのスクショを output/screens/<scene>/NN-<label>.png に保存 */
    async shot(label, target = page) {
      shotIndex += 1;
      const file = path.join(
        SCREEN_DIR,
        sceneName,
        `${String(shotIndex).padStart(2, "0")}-${label}.png`,
      );
      await target.screenshot({ path: file });
      console.log(`  📸 ${path.relative(OUTPUT_DIR, file)}`);
    },
    /** テイク終了。webm をシーン名にリネームして保存先を返す */
    async close() {
      const videos = context.pages().map((p) => p.video()).filter(Boolean);
      await context.close();
      const saved = [];
      for (const [i, video] of videos.entries()) {
        const raw = await video.path();
        const dest = path.join(
          VIDEO_DIR,
          i === 0 ? `${sceneName}.webm` : `${sceneName}-popup${i}.webm`,
        );
        await rename(raw, dest);
        saved.push(dest);
        console.log(`  🎞  ${path.relative(OUTPUT_DIR, dest)}`);
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
