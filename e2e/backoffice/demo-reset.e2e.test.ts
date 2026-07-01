import { describe, it, expect } from "vitest";
import { resetDemo, fetchAlerts } from "./support.js";

/**
 * 【demo reset 経路 E2E】`make reset`（= POST /demo/reset）→ GET /alerts の契約回帰テスト。
 *
 * 新しい契約（クリーン起動）: reset はアラートを seed せず一覧を空に戻し、既知パターン
 * （学習済みの知識ベース）だけを再投入する。審査員はデモシナリオを押して結果を観察する。
 * 過去の既知調査は KnownErrorPattern.archivedReport が保持し、既知一致時に Alert へ
 * 再利用表示される（静的ダミーで一覧を埋めない）。
 *
 * このテストは「reset したら一覧が空・パターンだけ seed される」ことを保証し、
 * backoffice 不起動や旧ビルド残存（reset が反映されない）でも赤くなる。
 */
describe("backoffice E2E: demo reset は一覧をクリーン起動する", () => {
  it("reset するとアラートは seed されず（0件）、パターンだけ seed される", async () => {
    const summary = await resetDemo();

    expect(summary.alertsSeeded).toBe(0);
    expect(summary.patternsSeeded).toBeGreaterThan(0);

    const alerts = await fetchAlerts();

    // reset 直後の一覧はクリーン（空）。シナリオ発火で初めてアラートが現れる。
    expect(alerts).toHaveLength(0);
  });
});
