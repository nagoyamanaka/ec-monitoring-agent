import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient } from "mongodb";
import {
  connectMonitoringDb,
  clearAlerts,
  triggerScenario,
  pollAlert,
  pollAlertById,
  fetchAlertById,
  submitFeedback,
  promoteAlert,
  BACKOFFICE_BASE_URL,
  KNOWN_ERROR_PATTERNS_COLLECTION,
  AlertPrimitives,
} from "./support.js";

// デモシナリオ 3b（インフラ障害・合成注入）の eventName。
// CloudMonitoringAlertTranslator が condition_name="CRITICAL log entries" を slugify した値で、
// category=INFRASTRUCTURE になる＝APPLICATION 専任 Policy ではなく完全一致フォールバックが
// 分類を担う経路（かつて配線漏れで常に未知→毎回 AI 調査になっていた回帰の対象）。
const INFRA_EVENT_NAME = "gcp.monitoring.critical_log_entries";
const PROMOTED_PATTERN_NAME = "PROMOTED_GCP.MONITORING.CRITICAL_LOG_ENTRIES";

/**
 * 【フィードバック・ライフサイクル E2E】未知障害の一生を HTTP API だけで縦に通す（stub AI・ブラウザ不要）。
 *
 *   ① 3b トリガー → 未知分類 → stub AI 調査レポート添付（自動調査）
 *   ② PATCH /feedback 承認（status は OPEN 据置・dedup 窓から外れる）
 *   ③ POST /promote 手動即時昇格（既知パターンへの結晶化）
 *   ④ 3b 再トリガー → 新規 Alert が即「既知」分類・AI 調査は走らない（再発は即・無料・決定論）
 *   ⑤ POST /report 既知 Alert へのオンデマンド AI 分析（202 → 非同期でレポート添付）
 *   ⑥ PATCH /feedback 却下（AI 訂正の指摘つき）→ POST /reinvestigate → 新レポートに差し替わる
 *
 * 承認/却下の分岐マトリクス自体は SubmitFeedbackUseCase の UT が担保済み。
 * ここで検証するのは「HTTP ルーティング → CommandBus → Mongo 永続 → 分類器（フォールバック含む）→
 * 非同期調査ループ」の配線が一本につながっていることだけ。
 *
 * 汚染対策: eventName はこのファイル固有（他テストは発火しない）だが、前回実行の残置
 * PROMOTED パターンがあると①が既知分類になり自壊するため、パターン削除→ clearAlerts の順で初期化する。
 */
describe("backoffice E2E: feedback lifecycle journey (stub AI)", () => {
  let mongo: MongoClient;
  let firstAlert: AlertPrimitives;
  let recurredAlert: AlertPrimitives;

  beforeAll(async () => {
    mongo = connectMonitoringDb();
    await mongo.connect();
    // 残置パターンの削除が clearAlerts より先（遅延イベントが来ても必ず未知分類にする）
    await mongo
      .db()
      .collection(KNOWN_ERROR_PATTERNS_COLLECTION)
      .deleteMany({ eventNamePattern: INFRA_EVENT_NAME });
    await clearAlerts();
  });

  afterAll(async () => {
    // 昇格で作った既知パターンは Mongo に永続するため、後続テスト・次回実行のため必ず消す
    await mongo
      .db()
      .collection(KNOWN_ERROR_PATTERNS_COLLECTION)
      .deleteMany({ eventNamePattern: INFRA_EVENT_NAME });
    await mongo.close();
  });

  it("① 3b トリガー → 未知分類で stub AI 調査レポートが添付される", async () => {
    await triggerScenario("3b");

    firstAlert = await pollAlert(
      (a) =>
        a.monitoringEvent.eventName === INFRA_EVENT_NAME &&
        a.investigationReport !== null,
    );

    expect(firstAlert.classification.type).toBe("unknown");
    expect(firstAlert.status).toBe("OPEN");
    expect(firstAlert.investigationReport?.isFallback).toBe(false);
  });

  it("② 承認しても OPEN 据置で feedback が記録される", async () => {
    await submitFeedback(firstAlert.id, { isCorrect: true });

    const approved = await fetchAlertById(firstAlert.id);
    expect(approved.feedback?.isCorrect).toBe(true);
    expect(approved.status).toBe("OPEN");
  });

  it("③ 手動昇格で既知パターンが結晶化される（sourceAlertId で撤回可能な形）", async () => {
    await promoteAlert(firstAlert.id);

    const pattern = await mongo
      .db()
      .collection(KNOWN_ERROR_PATTERNS_COLLECTION)
      .findOne({ eventNamePattern: INFRA_EVENT_NAME });
    expect(pattern).not.toBeNull();
    expect(pattern?.name).toBe(PROMOTED_PATTERN_NAME);
    expect(pattern?.sourceAlertId).toBe(firstAlert.id);
  });

  it("④ 再トリガーは新規 Alert として即「既知」分類・AI 調査は走らない", async () => {
    await triggerScenario("3b");

    // 承認済みの firstAlert へは畳み込まれない（dedup 窓から除外）＝新規 Alert が立つ
    recurredAlert = await pollAlert(
      (a) =>
        a.monitoringEvent.eventName === INFRA_EVENT_NAME &&
        a.id !== firstAlert.id,
    );

    expect(recurredAlert.classification.type).toBe("known");
    expect(recurredAlert.classification.patternName).toBe(PROMOTED_PATTERN_NAME);
    expect(recurredAlert.status).toBe("OPEN");
    // 既知一致は AI 調査を自動起動しない（レポート無しで即確定）
    expect(recurredAlert.investigationReport).toBeNull();
  });

  it("⑤ 既知 Alert へのオンデマンド AI 分析（POST /report）でレポートが添付される", async () => {
    const res = await fetch(
      `${BACKOFFICE_BASE_URL}/alerts/${recurredAlert.id}/report`,
      { method: "POST" },
    );
    expect(res.status).toBe(202);

    const reported = await pollAlertById(
      recurredAlert.id,
      (a) => a.investigationReport !== null && a.status === "OPEN",
    );
    expect(reported.investigationReport?.isFallback).toBe(false);
    recurredAlert = reported;
  });

  it("⑥ 却下（AI 訂正の指摘つき）→ 再調査で新しいレポートに差し替わる", async () => {
    const previousInvestigatedAt =
      recurredAlert.investigationReport?.investigatedAt;

    await submitFeedback(recurredAlert.id, {
      isCorrect: false,
      operatorNote: "根本原因は接続プール上限ではなく直前の Terraform 変更",
    });

    const res = await fetch(
      `${BACKOFFICE_BASE_URL}/alerts/${recurredAlert.id}/reinvestigate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorNote: "根本原因は接続プール上限ではなく直前の Terraform 変更",
        }),
      },
    );
    expect(res.status).toBe(202);

    const reinvestigated = await pollAlertById(
      recurredAlert.id,
      (a) =>
        a.status === "OPEN" &&
        a.investigationReport !== null &&
        a.investigationReport.investigatedAt !== previousInvestigatedAt,
    );
    // 再調査は「やり直し」＝過去のレビューをクリアし、新レポートを白紙で承認/却下できる状態に戻す
    // （Alert.reopenForReinvestigation の仕様。却下＝二値学習の feedback とは別概念）。
    expect(reinvestigated.feedback).toBeNull();
    expect(reinvestigated.investigationReport?.isFallback).toBe(false);
  });
});
