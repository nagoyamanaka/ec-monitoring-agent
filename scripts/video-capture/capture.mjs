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
  takeDir,
  dwell,
  resetDemo,
  triggerScenario,
  snapshotAlertIds,
  waitForAlert,
  waitForReport,
} from "./lib.mjs";

// part4 の draft PR カットで映す、事前確認済みの実 draft PR（AI 起票）。
// DRAFT_PR_URL 環境変数があればそちらが優先。
const DEFAULT_DRAFT_PR_URL = "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/29";

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
 * 引用チップ・証拠リンクの「証拠を開く / 修正 PR を開く」を **本編と同じタブ** で開いて見せる。
 * アプリ実装は target=_blank（別タブ）だが、Playwright は別タブを別 webm に録るうえ、
 * clickMaybePopup は popup を閉じてしまい mp4 化もされない＝**本編 mp4 に遷移先(PR)が一切写らない**。
 * 動画は「クリック→遷移先が同じ画面に出る」連続性が命。
 *
 * (c) 方式: **撮影時だけ** その <a> の target/rel を剥がし、**本物のクリック**で同一タブ遷移させる
 * （アプリのソースは無改変・DOM 属性を1要素だけ外すのみ）。別タブ popup を作らないので本編 mp4 に
 * 遷移先が写り、かつ「擬似操作」でなく実クリック→実遷移になる（偽カーソルの膨らみも実 mousedown で出る）。
 * 遷移先が落ちていても録画は止めない（警告のみ）。
 */
async function revealLinkSameTab(stage, locator, { label, dwellMs = 5000 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();
  await dwell(700);
  // 撮影時のみ別タブ化を無効化（この1要素だけ・ソース非改変）。
  await locator.evaluate((el) => {
    el.removeAttribute("target");
    el.removeAttribute("rel");
  });
  // noWaitAfter: click 起因の遷移で実行コンテキストが破棄されても例外にしない（遷移完了は下で待つ）。
  await locator.click({ noWaitAfter: true }).catch(() => {});
  await stage.page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
  await dwell(dwellMs);
  if (label) await stage.shot(label);
}

/**
 * シナリオ発火はデモ操作卓のボタンクリックを優先（映像に「注入の操作」が残る）。
 * 段階開示UI（D2）のため、シナリオ行クリックは注入ではなくパネル展開。実際の発火は
 * 展開後に現れる `aria-label="<ラベル> を実行"` ボタン。
 * どちらのボタンも見つからなければ API 直叩きにフォールバック（録画は続行）。
 */
async function triggerOnScreen(stage, buttonText, scenarioId) {
  const injectButton = stage.page.getByRole("button", { name: `${buttonText} を実行`, exact: true });
  if (!(await injectButton.count())) {
    const row = stage.page.getByRole("button").filter({ hasText: buttonText }).first();
    if (await row.count()) {
      await row.scrollIntoViewIfNeeded();
      await row.hover();
      await dwell(500);
      await row.click();
      await injectButton.waitFor({ timeout: 5_000 }).catch(() => {});
    }
  }
  if (await injectButton.count()) {
    await injectButton.scrollIntoViewIfNeeded();
    await injectButton.hover();
    await dwell(800);
    await injectButton.click();
    return;
  }
  console.warn(`  ⚠ デモ操作卓に「${buttonText}」の注入ボタンが見つからず API で発火`);
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

/** part1（カット1〜3前半）: 予報カード → 引用チップ解決 → 先手 → ブリッジCTA → /alerts 遷移 */
async function sceneForecast() {
  // 予報はインメモリ保持で backend 再起動で揮発する。未生成のまま録画すると
  // 空ページのテイクを量産するので、録画開始前に落とす。
  const probe = await fetch(`${process.env.API_URL ?? "http://localhost:3001"}/forecast`);
  if (!probe.ok) {
    throw new Error(
      `GET /forecast -> ${probe.status}: 予報が未生成です。リハなら POST /forecast（ローカルは stub・課金なし）、` +
        "本番テイクなら F8 seed で再生成してから撮り直してください。",
    );
  }
  const stage = await openStage("part1-forecast");
  const { page } = stage;
  try {
    await page.goto(`${FRONT_URL}/forecast`);
    const card = page.locator("article").first(); // RiskCard（aria-label="<レベル>: <subject>"）
    await card.waitFor({ timeout: 20_000 });
    await dwell(8_000); // カット1: カード全景の静止尺（フック）
    await stage.shot("forecast-card"); // ProtoPedia 画像1

    // カット2: 引用チップの「証拠を開く」を順に開く。外部（plan-1→PR #83 / pr-55 draft）は
    // 本編と同一タブで遷移して PR を本編 mp4 に写す（別タブ popup だと本編に写らない）。開いたら
    // /forecast へ戻って次のチップへ。過去Alert(内部リンク)は下で別途アプリ内遷移。
    const externalChips = card.locator('a[href^="http"]');
    const externalCount = Math.min(await externalChips.count(), 2);
    for (let i = 0; i < externalCount; i++) {
      await revealLinkSameTab(stage, externalChips.nth(i), {
        label: `citation-external-${i + 1}`,
      });
      // 外部（github）から戻るのは goBack だと SPA カードが復帰しないことがある
      // （クロスオリジン遷移後の bfcache 無効化）。/forecast へ明示 goto して確実に再描画。
      await page.goto(`${FRONT_URL}/forecast`);
      await card.waitFor({ timeout: 15_000 });
      await dwell(1_500);
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

/** part2（カット3後半〜5）: 3b発火 → 着弾/未知分類 → ADKライブ調査（実時間・編集で倍速）→ レポート/証拠 → 承認直前まで */
async function sceneInvestigation() {
  if (process.env.RESET === "1") {
    console.log("  ↺ demo reset");
    await resetDemo();
  }
  const stage = await openStage("part2-investigation");
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

    // part2 は「承認を押す直前」で止める（承認は part3=learning シーン）
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

/** part3（カット5承認〜6）: 承認 → 既知へ昇格 → 3b再発火 → 即・既知判定の対比 */
async function sceneLearning() {
  const stage = await openStage("part3-learning");
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
    // 承認は submitFeedback→refreshCurrent の往復後に反映されるため、固定 dwell でなく
    // 「承認済み」表示を待ってから次へ（往復が遅いテイクでも昇格ボタンを取りこぼさない）。
    await page
      .getByRole("button", { name: "承認済み" })
      .waitFor({ timeout: 10_000 })
      .catch(() => {});
    await dwell(3_000); // 承認完了通知（学習への反映）を映す

    const promote = page.getByRole("button", { name: /既知パターンへ昇格/ }).first();
    await promote.waitFor({ timeout: 10_000 }).catch(() => {});
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

/** part4（カット7素材）: 脆弱性検知（シナリオ4）→ 事前起票済みの実 draft PR（DRAFT_PR_URL） */
async function sceneDogfooding() {
  const stage = await openStage("part4-dogfooding");
  const { page } = stage;
  try {
    await page.goto(`${FRONT_URL}/alerts`);
    await dwell(2_000);

    const before = await snapshotAlertIds();
    await triggerOnScreen(stage, "脆弱性検知", "4");
    const alert = await waitForAlert((a) => !before.has(a.id), { label: "security-vuln" });
    await dwell(3_000);
    await gotoAlertDetail(stage, alert.id);
    await dwell(3_000);
    await stage.shot("cve-alert-investigating");

    // 調査完了を待つ（実 Gemini・約2分）。完了すると RemediationPanel が
    // 「修正 PR を開く →」の実リンク（remediation mode=demo=事前起票の PR #29）を出す。
    await waitForReport(alert.id).catch(() => {});
    await dwell(4_000);
    await stage.shot("cve-alert");

    // 起票は人間の承認アクション。調査完了時点では RemediationPanel は status=none で
    // 「修正を起票」ボタンを出す（drafted リンクはまだ無い）。実際にボタンをクリックして
    // PR を起票させる（demo モードは事前起票の PR #29 を即 drafted で返す）。これで動線が
    // 「CVE検知 → AI調査 → 修正を起票 → 修正PR」の1本に繋がる。
    const draftButton = page
      .getByRole("button", { name: "修正を起票", exact: true })
      .first();
    if (await draftButton.count()) {
      await draftButton.scrollIntoViewIfNeeded();
      await draftButton.hover();
      await dwell(1_500);
      await draftButton.click();
      await dwell(2_000);
      await stage.shot("remediation-drafted");
    } else {
      console.warn("  ⚠ 「修正を起票」ボタン未検出（remediable=false の可能性）");
    }

    // 起票後 drafted になると「修正 PR を開く →」の実リンクが出る。出現を待ってから
    // アプリ内の実リンクを (c)方式で同一タブ遷移＝本編 mp4 に PR を写す。
    const prLink = page.getByRole("link", { name: /修正 PR を開く/ }).first();
    await prLink.waitFor({ timeout: 30_000 }).catch(() => {});
    if (await prLink.count()) {
      await revealLinkSameTab(stage, prLink, { label: "draft-pr", dwellMs: 6_000 });
    } else {
      // 修正リンクが出ない環境（remediation 未 drafted 等）は既定 PR へ直行フォールバック。
      const prUrl = process.env.DRAFT_PR_URL || DEFAULT_DRAFT_PR_URL;
      console.warn("  ⚠ 「修正 PR を開く」リンク未検出。既定 PR に直行フォールバック");
      await page.goto(prUrl);
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
      await dwell(6_000);
      await stage.shot("draft-pr");
    }
  } finally {
    await stage.close();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const SCENES = {
  forecast: sceneForecast, // part1 = カット1〜3前半（予報→引用→先手→ブリッジ遷移）
  investigation: sceneInvestigation, // part2 = カット3後半〜5（着弾→調査→レポート。実 Gemini 約2分を含む）
  learning: sceneLearning, // part3 = カット5承認〜6（investigation の直後に実行する前提）
  dogfooding: sceneDogfooding, // part4 = カット7素材（CVE + draft PR）
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
console.log(`\n✅ 完了。テイク: ${await takeDir()}`);
