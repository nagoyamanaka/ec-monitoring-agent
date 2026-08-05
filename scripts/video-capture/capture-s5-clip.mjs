// スライド S5（予報デモ）に埋める27秒クリップ専用の収録。
//
//   node capture-s5-clip.mjs           # 新規テイクを自動採番
//   TAKE=take009 node capture-s5-clip.mjs
//
// 前提は capture.mjs と同じ（ローカル compose 起動済み・FORECAST_ENABLED=true・予報は
// **事前生成済み**＝撮影中に POST /forecast を走らせない）。詳細は README.md。
//
// ## capture.mjs の `forecast` シーンと分けた理由
//
// あちらは台本カット1〜3の**素材**（ProtoPedia 用スクショ込み・実測 約49秒）で、
// 2枚目のリスクカード（Valkey）・PR #83・アラート詳細・ブリッジCTA まで写る。
// S5 に要るのは3画面だけなので、49秒から切り出すと「使わないフレームの時刻表」を
// 人手で作ることになり、素材を撮り直すたびに全部やり直しになる（旧 cut_s3_clip.sh が
// まさにそれで、素材の時刻が10行ぶん決め打ちになっていた）。
// **ここでは要る画面しか撮らない**＝カットは各ビートの頭を落とすだけで済む。
//
// ## ビート（ナレ ブロック3［予報デモ］と1対1・画面3つ・ページ遷移2回）
//
//   [A] /forecast 先頭で静止（何が→いつまでに→何をする→なぜ→根拠が1画面に収まる）
//       …「予報を見ると、今週末、DB接続プールの枯渇リスク。…HIGHと判定されています。
//          これが…意思決定の材料です。」
//       ビート末でカーソルが引用 pr-55 の「証拠を開く」へ動いてクリック
//   [B] 実在する PR #55（同一タブ遷移）
//       …「根拠の引用をクリックすると、実在するPull Requestに着地します。」
//   [C] /forecast へ戻り「今打てる先手」にカーソルを置いて停止
//       …「予報には『いま打てる先手』も提言されます。実行するのは人間です。」
//       ここが**埋め込み動画の止まる1枚**（質疑中も投影され続ける）。
//
// **尺は撮影側で作らない**（README の原則）。各ビートは必要より長く撮り、
// temp/hackathon-study/slides/cut_s3_clip.sh が 14.60 / 5.90 / 6.50 秒へ切る。
// 倍速・setpts は使わない＝素材と完成尺が1対1で対応する。
import { openStage, dwell, FRONT_URL, API_URL } from "./lib.mjs";

/** 引用チップのうち、クリックして見せる PR。差し替えるときは PR_MATCH=/pull/83 のように渡す。 */
const PR_MATCH = process.env.PR_MATCH ?? "/pull/55";
/** 予報の1枚目に来ていてほしいリスク（違えば撮らずに落とす）。 */
const EXPECT_SUBJECT = process.env.EXPECT_SUBJECT ?? "db_connection_pool";
/** PR ページだけに当てる拡大率（後述）。 */
const PR_ZOOM = process.env.PR_ZOOM ?? "1.35";

/**
 * 引用の「証拠を開く」を **本編と同じタブ** で開く。
 * capture.mjs の revealLinkSameTab と同じ理由——アプリ実装は target=_blank で、Playwright は
 * 別タブを別 webm に録るため、そのままだと**本編 mp4 に PR が1フレームも写らない**。
 * 撮影時だけその <a> の target/rel を剥がし、**本物のクリック**で同一タブ遷移させる
 * （アプリのソースは無改変・DOM 属性を1要素だけ外すのみ）。
 */
async function clickSameTab(page, locator) {
  // 引用カード全体が <a> なので、既定のクリック位置（中央）だとカーソルがタイトル文字の
  // 上に乗る。ナレは「根拠の引用をクリックすると」なので、**「証拠を開く」の上**で
  // 狙って押す画にする（要素内の相対座標で指定）。
  const position = await locator.evaluate((a) => {
    // ラベルはアイコン付きの <span>（子要素を持つ）なので「葉」では拾えない。
    // 文字列が一致する最も深い要素＝最後のマッチを採る。
    const cta = [...a.querySelectorAll("*")]
      .filter((e) => e.textContent?.trim() === "証拠を開く")
      .pop();
    if (!cta) return undefined;
    const ab = a.getBoundingClientRect();
    const cb = cta.getBoundingClientRect();
    return { x: cb.x + cb.width / 2 - ab.x, y: cb.y + cb.height / 2 - ab.y };
  });
  await locator.hover(position ? { position } : {});
  await dwell(1_400); // カーソルが着いてから押すまでの間（クリックが動画で追える）
  await locator.evaluate((el) => {
    el.removeAttribute("target");
    el.removeAttribute("rel");
  });
  // noWaitAfter: 遷移で実行コンテキストが壊れても例外にしない（遷移完了は下で待つ）。
  await locator.click({ ...(position ? { position } : {}), noWaitAfter: true }).catch(() => {});
  await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
}

/** 予報が撮れる状態かを撮影前に確かめる（生成のたびに文言が変わるので毎回見る）。 */
async function preflight() {
  const res = await fetch(`${API_URL}/forecast`);
  if (!res.ok) {
    throw new Error(
      `GET /forecast -> ${res.status}: 予報が未生成です。POST /forecast で生成してから撮ってください。`,
    );
  }
  const { forecast } = await res.json();
  const first = forecast?.risks?.[0];
  if (!first) throw new Error("予報にリスクが1件もありません。");
  console.log(`  予報 generatedAt: ${forecast.generatedAt}  isFallback: ${forecast.isFallback}`);
  console.log(`  1枚目: ${first.subject} / ${first.level} / 引用 ${first.citations.join(", ")}`);
  if (forecast.isFallback) throw new Error("fallback 予報です（AI 経路が落ちている）。撮り直し。");
  if (!first.subject.includes(EXPECT_SUBJECT)) {
    throw new Error(
      `1枚目が ${first.subject} で ${EXPECT_SUBJECT} ではありません。ナレと画が合わないので撮りません。`,
    );
  }
  if (first.level !== "HIGH") {
    throw new Error(`1枚目が ${first.level} です。ナレは「HIGHと判定されています」なので撮りません。`);
  }
}

async function main() {
  await preflight();
  const stage = await openStage("s5-forecast");
  const { page } = stage;
  const t0 = Date.now();
  const mark = (label) => console.log(`  ⏱ ${((Date.now() - t0) / 1000).toFixed(2)}s  ${label}`);
  try {
    await page.goto(`${FRONT_URL}/forecast`);
    const card = page.locator("article").first();
    await card.waitFor({ timeout: 20_000 });
    mark("[A] 予報カード表示");

    // 確信度%が1フレームも映らないこと（R1 の最重要判定）を DOM 側でも見ておく。
    // 最終判定はカット後のコンタクトシートで人がやる＝ここは早期警告。
    const pct = await page.evaluate(() =>
      [...document.querySelectorAll("article, h1, h2, p, span, nav")]
        .filter((e) => e.children.length === 0 && /\d\s*[%％]/.test(e.textContent ?? ""))
        .map((e) => e.textContent.trim().slice(0, 80)),
    );
    if (pct.length) console.warn(`  ⚠ 画面に % が出ています: ${JSON.stringify(pct)}`);

    await dwell(16_000); // [A] の静止尺（カットで 14.60 秒ぶんを後ろから取る）

    const prLink = card.locator(`a[href*="${PR_MATCH}"]`).first();
    if (!(await prLink.count())) {
      throw new Error(`1枚目の引用に ${PR_MATCH} がありません（PR_MATCH= で指定し直す）。`);
    }
    mark("[A→B] 引用クリック");
    await clickSameTab(page, prLink);
    // GitHub 側だけ 1.35 倍で描く（ブラウザの拡大と同じこと・ページは無改変）。
    // 5.9秒しか映らないビートで読ませたいのは「タイトル・#55・Draft・リポジトリ名・本文」で、
    // 等倍だと本文が 13px まで落ちて投影で読めない。ついでに PR タイムライン下部が
    // 画面外へ落ちる＝映すべきものだけが残る。
    // 拡大は load 後に当てる（addInitScript の document-start 注入は GitHub 側で効かなかった）。
    // 反映のリフローは**カットの頭で落とす**ので完成尺には出ない。
    // GitHub は load 後にもう一段ナビゲートすることがあり、素で evaluate すると
    // "Execution context was destroyed" で落ちるので、落ち着くのを待って数回試す。
    await page.locator("h1").first().waitFor({ timeout: 20_000 }).catch(() => {});
    for (let i = 0; i < 5; i++) {
      const ok = await page
        .evaluate((zoom) => {
          document.body.style.zoom = zoom;
          window.scrollTo(0, 0);
          return true;
        }, PR_ZOOM)
        .catch(() => false);
      if (ok) break;
      await dwell(500);
    }
    mark("[B] PR 表示");
    await dwell(9_000); // [B]（カットで頭から 5.90 秒）
    await stage.shot("pr-landing");

    // 戻りは goBack ではなく goto。クロスオリジン遷移で bfcache が無効化され、
    // goBack だと SPA のカードが復帰しないことがある（capture.mjs と同じ判断）。
    await page.goto(`${FRONT_URL}/forecast`);
    await card.waitFor({ timeout: 20_000 });
    mark("[C] 予報へ復帰");
    await dwell(1_500);
    // 「今打てる先手」へカーソルを置いて停止する（止まる1枚がここ）。
    // hover(要素) だと水色ドットが見出しの文字に重なって「今打<●>る先手」になるので、
    // ブロックの左パディングへ実座標で置く（指し示すが隠さない）。
    const box = await page.evaluate(() => {
      const label = [...document.querySelectorAll("article p")].find((p) =>
        p.textContent?.includes("今打てる先手"),
      );
      const r = label?.parentElement?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y } : null;
    });
    if (box) await page.mouse.move(box.x + 14, box.y + 30, { steps: 24 });
    await dwell(11_000); // [C]（カットで 6.50 秒）
    await stage.shot("preventive-action");
    mark("[C] 終了");
  } finally {
    const saved = await stage.close();
    console.log(`\n  出力: ${saved.join("\n        ")}`);
  }
}

await main();
