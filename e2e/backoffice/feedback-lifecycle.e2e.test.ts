import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient } from "mongodb";
import {
  connectMonitoringDb,
  clearAlerts,
  triggerScenario,
  resetDemo,
  pollAlert,
  pollAlertById,
  fetchAlertById,
  submitFeedback,
  promoteAlert,
  clearSimilarIncidentsByNote,
  BACKOFFICE_BASE_URL,
  KNOWN_ERROR_PATTERNS_COLLECTION,
  AlertPrimitives,
} from "./support.js";

// 類似シナリオ（デモ 2 / payment-declined）の実 APPLICATION イベントの eventName。
// 実トリガ: PaymentMode=DECLINED の実注文 → EC が PaymentDeclinedDomainEvent を発火 →
// RabbitMQ 経由で ingest。既知パターン（ec.payment.timeout）には完全一致せず、過去の
// 解決済み事例がコーパスにあれば SimilarPatternRule が graded confidence（類似・準既知）で拾う経路。
const SIMILAR_EVENT_NAME = "ec.payment.declined";

// 承認時に添える「訂正＝確定した原因/症状」。次回の類似判定の根拠テキスト（resolvedNote）になる。
// SimilarPatternRule のクエリ文（eventName＋payload の reason。UUID/数値ノイズは除外される）と
// トークン集合が一致するよう語彙を意図的に被らせ、字句類似（Jaccard）を 1.0 に寄せている。
// これで reset シードの事例（0.714）より確実に上位で選ばれ、「最良一致＝この承認で焼いた
// 訂正事例」を決定的にできる（sourceAlertId で突合）。
const OPERATOR_CORRECTION = "reason: payment provider unavailable declined";

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

/**
 * 【類似学習ループ E2E】「オペレーターの訂正が、次回の分類の正になる」一周を HTTP API だけで通す。
 *
 *   ① 類似シナリオ（payment-declined・実注文トリガ）を発火 → 承認できる Alert を1件得る
 *   ② 訂正メモつきで承認 → その訂正が解決済み事例（resolvedNote）としてコーパスに index される
 *   ③ 同型が再発 → 承認済みは畳み込まれず新規 Alert が立ち、①②で学習した訂正事例に
 *      SIMILARITY で即分類される（AI 調査は走らない）。sourceAlertId が②で承認した Alert を指す
 *      ＝「この訂正がこの分類の根拠になった」ことを決定的に突合する。
 *
 * SubmitFeedbackUseCase の UT が「承認で operatorNote→resolvedNote を index する」ドメイン挙動を
 * 担保済み。ここで検証するのは「PATCH /feedback → InMemory コーパス → 次回 ingest の分類器
 * （SimilarPatternRule / source=SIMILARITY）」の配線が一本につながっていること。
 *
 * 汚染対策: InMemory コーパスはサーバプロセス内で永続し、reset シードや過去実行の事例が
 * 同 eventName に残りうる。②の訂正メモは Jaccard=1.0 に寄せてあり、コーパスの他事例（≦0.714）より
 * 必ず上位、かつ最新挿入が同点タイでも先に選ばれるため、③の最良一致は常に「直前に承認した Alert」になる。
 */
describe("backoffice E2E: similarity learning loop (feedback → corpus → SIMILARITY)", () => {
  let correctedAlert: AlertPrimitives;
  let recurredSimilar: AlertPrimitives;

  beforeAll(async () => {
    // reset で解決済み事例 seed（字句類似 0.714）をコーパスへ投入し、①が環境によらず
    // SIMILARITY 即分類（AI 調査なし）になる前提を成立させる。CI の新品 ES はコーパスが空で
    // ①が「未知」分類→非同期 AI 調査が走り、②の feedback 保存が調査完了時の全文書 save に
    // 上書きされる lost update（feedback 消失→③は dedup 畳み込みでタイムアウト）を踏む。
    // ローカル ES は過去の reset で seed 済みのため顕在化しない（make e2e は通る）差分の吸収。
    await resetDemo();
    // ES は永続するため、過去実行が残した同署名の学習事例を先に掃除する（タイ回避＝突合を決定的に）。
    // reset シード（別文言・0.714）は残る＝上の前提は崩さない。
    await clearSimilarIncidentsByNote(OPERATOR_CORRECTION);
    // 既存 Alert を消して、①の発火が畳み込まれず新規 Alert として立つようにする
    // （コーパスの解決済み事例は Alert ではないので消えない＝学習は保持される）。
    await clearAlerts();
  });

  afterAll(async () => {
    // 焼いた学習事例を残さない（次回実行・後続テストの類似判定を汚さない）。
    await clearSimilarIncidentsByNote(OPERATOR_CORRECTION);
  });

  it("① 類似シナリオ（実注文トリガ）を発火し、承認できる Alert を1件得る", async () => {
    await triggerScenario("payment-declined");

    correctedAlert = await pollAlert(
      (a) => a.monitoringEvent.eventName === SIMILAR_EVENT_NAME,
    );
    expect(correctedAlert.id).toBeTruthy();
  });

  it("② 訂正メモつきで承認すると、訂正が解決済み事例としてコーパスに学習される", async () => {
    await submitFeedback(correctedAlert.id, {
      isCorrect: true,
      operatorNote: OPERATOR_CORRECTION,
    });

    const approved = await fetchAlertById(correctedAlert.id);
    expect(approved.feedback?.isCorrect).toBe(true);
    expect(approved.feedback?.operatorNote).toBe(OPERATOR_CORRECTION);
    // 類似既知はレポート無し（既知は AI を自動起動しない）＝結晶化の材料が無く自動昇格しない。
    // レポートがあっても単一承認の加重スコアは 1.0 未満で昇格しない（即昇格は手動 /promote の領分）。
    // よって③の再発は EXACT_MATCH ではなく SIMILARITY 経路で分類される（承認は OPEN 据置）。
    expect(approved.status).toBe("OPEN");
  });

  it("③ 同型が再発すると、新規 Alert が承認済みの訂正事例に SIMILARITY で即分類される", async () => {
    await triggerScenario("payment-declined");

    // 承認済みの correctedAlert へは畳み込まれない（dedup 窓から除外）＝新規 Alert が立つ。
    recurredSimilar = await pollAlert(
      (a) =>
        a.monitoringEvent.eventName === SIMILAR_EVENT_NAME &&
        a.id !== correctedAlert.id &&
        a.classification.type === "known",
    );

    expect(recurredSimilar.classification.source).toBe("SIMILARITY");
    expect(recurredSimilar.classification.patternName).toMatch(/^類似既知:/);
    // 学習根拠の突合: 最良一致は②で承認した訂正事例＝この分類の根拠は correctedAlert 由来。
    // 「オペレーターの訂正が、次回の分類の正になった」ことの決定的な証拠。
    expect(recurredSimilar.classification.sourceAlertId).toBe(correctedAlert.id);
    // 類似一致は AI 調査を自動起動しない（即・無料・決定論）。
    expect(recurredSimilar.investigationReport).toBeNull();
  });
});
