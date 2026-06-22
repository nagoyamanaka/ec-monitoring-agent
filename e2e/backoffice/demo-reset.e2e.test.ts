import { describe, it, expect } from "vitest";
import { resetDemo, fetchAlerts } from "./support.js";

/**
 * 【demo reset 経路 E2E】`make reset`（= POST /demo/reset）→ GET /alerts の契約回帰テスト。
 *
 * 背景: reset が alert を seed するよう拡張されたが、
 *   1) seed の AlertId が非 UUID で起動時 throw → backoffice がそもそも起動できない、
 *   2) 旧ビルドが動き続けて seed が反映されず一覧が空（{alerts: []}）になる、
 * という front-back 統合の穴を検知できなかった。
 *
 * このテストは「reset したら seed 済み alert が一覧 API で取得できる」ことを保証し、
 * 上記いずれの破綻でも（backoffice 不起動 or 空一覧）赤くなる。
 */
describe("backoffice E2E: demo reset seeds alerts", () => {
  it("reset すると alert/pattern が seed され、GET /alerts で取得できる", async () => {
    const summary = await resetDemo();

    expect(summary.alertsSeeded).toBeGreaterThan(0);
    expect(summary.patternsSeeded).toBeGreaterThan(0);

    const alerts = await fetchAlerts();

    // reset 直後の一覧件数は seed した alert 数と一致する（空配列バグの回帰防止）。
    expect(alerts).toHaveLength(summary.alertsSeeded);
  });

  it("seed には完全一致・類似・未知の各分類が含まれ、UI の出し分け前提を満たす", async () => {
    await resetDemo();
    const alerts = await fetchAlerts();

    const known = alerts.filter((a) => a.classification.type === "known");
    const unknown = alerts.filter((a) => a.classification.type === "unknown");

    // 既知パターン（完全一致／類似）と未知（AI調査対象）の双方が seed されている。
    expect(known.length).toBeGreaterThan(0);
    expect(unknown.length).toBeGreaterThan(0);

    // 既知 alert は分類ソース（EXACT_MATCH / SIMILARITY 等）を持つ。
    for (const alert of known) {
      expect(alert.classification.source).toBeTruthy();
    }
  });
});
