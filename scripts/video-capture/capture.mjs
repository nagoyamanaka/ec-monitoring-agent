// 提出動画の素材テイクを自動採取する撮影スクリプト。
// 台本: docs/protopedia/video/script.md（カット番号は台本と対応）
//
//   node capture.mjs all                    # 全シーン順撮り
//   node capture.mjs forecast investigation # シーン指定
//
// 前提: docker compose (local) 起動済み・実 Gemini 経路（.env.local）・FORECAST_ENABLED=true・
//       予報は事前生成済み（撮影中に POST /forecast を走らせない）。詳細は README.md。
import {
  FRONT_URL,
  openStage,
  dwell,
  resetDemo,
  triggerScenario,
  snapshotAlertIds,
  waitForAlert,
  waitForReport,
} from "./lib.mjs";

// ---------------------------------------------------------------------------
// 小道具
// ---------------------------------------------------------------------------

/**
 * リンクをクリックし、新規タブ（GitHub 等 target=_blank）が開けばそのページを、
 * 同一タブ遷移なら null を返す。外部が落ちていても録画を止めない（警告のみ）。
 */
async function clickMaybePopup(stage, locator, { dwellMs = 4000, label } = {}) {
  const popupPromise = stage.context
    .waitForEvent("page", { timeout: 5_000 })
    .catch(() => null);
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();
  await dwell(600);
  await locator.click();
  const popup = await popupPromise;
  if (popup) {
    await popup.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
    await dwell(dwellMs);
    if (label) await stage.shot(label, popup);
    await popup.close();
    return popup;
  }
  await dwell(dwellMs);
  if (label) await stage.shot(label);
  return null;
}

/**
 * シナリオ発火はデモ操作卓のボタンクリックを優先（映像に「注入の操作」が残る）。
 * ボタンが見つからなければ API 直叩きにフォールバック（録画は続行）。
 */
async function triggerOnScreen(stage, buttonText, scenarioId) {
  const button = stage.page.getByRole("button").filter({ hasText: buttonText }).first();
  if (await button.count()) {
    await button.scrollIntoViewIfNeeded();
    await button.hover();
    await dwell(800);
    await button.click();
    return;
  }
  console.warn(`  ⚠ デモ操作卓に「${buttonText}」が見つからず API で発火`);
  await triggerScenario(scenarioId);
}

/** 一覧の行クリックで詳細へ（リンクが拾えなければ deep link 直行にフォールバック） */
async function gotoAlertDetail(stage, alertId) {
  const link = stage.page.locator(`a[href$="/alerts/${alertId}"]`).first();
  if (await link.count()) {
    await link.scrollIntoViewIfNeeded();
    await link.hover();
    await dwell(500);
    await link.click();
  } else {
    await stage.page.goto(`${FRONT_URL}/alerts/${alertId}`);
  }
  await stage.page.waitForURL(`**/alerts/${alertId}`, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// シーン（1シーン=1テイク=1webm）
// ---------------------------------------------------------------------------

/** カット1〜3: 予報カード → 引用チップ解決 → 先手 → ブリッジCTA → /alerts 遷移 */
async function sceneForecast() {
  const stage = await openStage("forecast");
  const { page } = stage;
  try {
    await page.goto(`${FRONT_URL}/forecast`);
    const card = page.locator("article").first(); // RiskCard（aria-label="<レベル>: <subject>"）
    await card.waitFor({ timeout: 20_000 });
    await dwell(8_000); // カット1: カード全景の静止尺
    await stage.shot("forecast-card"); // ProtoPedia 画像1

    // カット2: 引用チップを順にクリック。外部（PR/plan）は新規タブ、過去Alertはアプリ内遷移。
    const externalChips = card.locator('a[href^="http"]');
    const externalCount = Math.min(await externalChips.count(), 2);
    for (let i = 0; i < externalCount; i++) {
      await clickMaybePopup(stage, externalChips.nth(i), {
        label: `citation-external-${i + 1}`,
      });
    }
    const internalChip = card.locator('a[href^="/alerts"]').first();
    if (await internalChip.count()) {
      await internalChip.scrollIntoViewIfNeeded();
      await internalChip.hover();
      await dwell(600);
      await internalChip.click();
      await dwell(4_000);
      await stage.shot("citation-past-alert");
      await page.goBack();
      await card.waitFor({ timeout: 10_000 });
    }

    // カット3: 先手 → ブリッジCTA（保険トーン）→ 反応的パイプラインへ
    const preventive = page.getByText("今打てる先手").first();
    if (await preventive.count()) {
      await preventive.scrollIntoViewIfNeeded();
      await dwell(3_000);
      await stage.shot("preventive-action");
    }
    const bridge = page.locator('aside[aria-label="反応的パイプラインへの案内"]');
    await bridge.scrollIntoViewIfNeeded();
    await dwell(3_000);
    await bridge.getByRole("link", { name: /アラート一覧を見る/ }).click();
    await page.waitForURL("**/alerts", { timeout: 10_000 });
    await dwell(3_000);
  } finally {
    await stage.close();
  }
}

/** カット4〜6: 3b発火 → 着弾/未知分類 → ADKライブ調査（実時間・編集で倍速）→ レポート/証拠 → 承認直前まで */
async function sceneInvestigation() {
  if (process.env.RESET === "1") {
    console.log("  ↺ demo reset");
    await resetDemo();
  }
  const stage = await openStage("investigation");
  const { page } = stage;
  try {
    await page.goto(`${FRONT_URL}/alerts`);
    await dwell(2_000);

    const before = await snapshotAlertIds();
    await triggerOnScreen(stage, "インフラ障害（合成・反復用）", "3b");
    const alert = await waitForAlert((a) => !before.has(a.id), { label: "3b" });
    await dwell(3_000); // SSE 着弾が一覧に現れる間
    await stage.shot("alert-arrival");

    await gotoAlertDetail(stage, alert.id);
    await dwell(3_000);
    await stage.shot("classified-unknown");

    // ライブ調査: レポート完成まで画面は置きっぱなし（この区間を編集で2〜4倍速にする）。
    // 途中でタイムラインのスクショを1枚（ProtoPedia 画像3）。
    const reportReady = waitForReport(alert.id);
    await dwell(30_000);
    await stage.shot("live-timeline"); // ProtoPedia 画像3
    await reportReady;
    await dwell(4_000); // レポートが SSE で流れ込み描画される間
    await stage.shot("report");

    // 証拠リンク（実コミット/実PR）を1つ開いて戻る
    const evidenceLink = page.locator('main a[href^="http"]').first();
    if (await evidenceLink.count()) {
      await clickMaybePopup(stage, evidenceLink, { label: "evidence-resolved" });
    }
    await stage.shot("evidence-panel"); // ProtoPedia 画像4

    // カット6は「承認を押す直前」で止める（承認はカット7=learning シーン）
    const approve = page.getByRole("button", { name: "承認", exact: true }).first();
    if (await approve.count()) {
      await approve.scrollIntoViewIfNeeded();
      await approve.hover();
      await dwell(2_000);
    }
    console.log(`  ✔ alert=${alert.id}（learning シーンで使用）`);
  } finally {
    await stage.close();
  }
}

/** カット7: 承認 → 既知へ昇格 → 3b再発火 → 即・既知判定の対比 */
async function sceneLearning() {
  const stage = await openStage("learning");
  const { page } = stage;
  try {
    // investigation シーンで調査済み・未レビューの 3b Alert を対象にする
    const target = await waitForAlert(
      (a) =>
        a.monitoringEvent.eventName.includes("critical_log_entries") &&
        a.investigationReport !== null &&
        a.feedback === null,
      { timeoutMs: 10_000, label: "investigated-3b" },
    );
    await page.goto(`${FRONT_URL}/alerts/${target.id}`);
    await dwell(2_000);

    const approve = page.getByRole("button", { name: "承認", exact: true }).first();
    await approve.scrollIntoViewIfNeeded();
    await dwell(1_000);
    await approve.click();
    await dwell(4_000); // 承認完了通知（学習への反映）を映す

    const promote = page.getByRole("button", { name: /既知へ昇格/ }).first();
    if (await promote.count()) {
      await promote.scrollIntoViewIfNeeded();
      await dwell(1_000);
      await promote.click();
      await dwell(3_000);
    } else {
      console.warn("  ⚠ 昇格ボタンが見つからない（承認済み状態を確認）");
    }

    // 再発火 → 今度は AI なし・即「既知」
    await page.goto(`${FRONT_URL}/alerts`);
    await dwell(1_500);
    const before = await snapshotAlertIds();
    await triggerOnScreen(stage, "インフラ障害（合成・反復用）", "3b");
    await waitForAlert(
      (a) => !before.has(a.id) && a.classification.type === "known",
      { timeoutMs: 30_000, label: "refire-known" },
    );
    await dwell(4_000);
    await stage.shot("known-instant"); // ProtoPedia 画像5
    await dwell(3_000);
  } finally {
    await stage.close();
  }
}

/** カット8: 脆弱性検知（シナリオ4）→ 事前起票済みの実 draft PR（DRAFT_PR_URL） */
async function sceneDogfooding() {
  const stage = await openStage("dogfooding");
  const { page } = stage;
  try {
    await page.goto(`${FRONT_URL}/alerts`);
    await dwell(2_000);

    const before = await snapshotAlertIds();
    await triggerOnScreen(stage, "脆弱性検知", "4");
    const alert = await waitForAlert((a) => !before.has(a.id), { label: "security-vuln" });
    await dwell(3_000);
    await gotoAlertDetail(stage, alert.id);
    await dwell(4_000);
    await stage.shot("cve-alert");

    // AI が起票した実 draft PR（人間が事前確認した URL を env で渡す）
    const prUrl = process.env.DRAFT_PR_URL;
    if (prUrl) {
      await page.goto(prUrl);
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
      await dwell(6_000);
      await stage.shot("draft-pr");
    } else {
      console.warn("  ⚠ DRAFT_PR_URL 未指定のため draft PR カットはスキップ");
    }
  } finally {
    await stage.close();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const SCENES = {
  forecast: sceneForecast, // カット1〜3
  investigation: sceneInvestigation, // カット4〜6（実 Gemini 約2分を含む）
  learning: sceneLearning, // カット7（investigation の直後に実行する前提）
  dogfooding: sceneDogfooding, // カット8
};

const args = process.argv.slice(2);
const names = args.includes("all") || args.length === 0 ? Object.keys(SCENES) : args;

for (const name of names) {
  const scene = SCENES[name];
  if (!scene) {
    console.error(`未知のシーン: ${name}（候補: ${Object.keys(SCENES).join(", ")} | all）`);
    process.exit(1);
  }
}

console.log(`🎬 撮影開始: ${names.join(" → ")}（FRONT=${FRONT_URL}）`);
for (const name of names) {
  console.log(`\n▶ scene: ${name}`);
  await SCENES[name]();
}
console.log("\n✅ 完了。output/video/*.webm と output/screens/ を確認してください。");
