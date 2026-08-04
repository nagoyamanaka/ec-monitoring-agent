import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { MongoAlertRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { InvestigationReport } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/InvestigationReport.js";
import { MongoRiskForecastRepository } from "../../../../../Contexts/Monitoring/Forecast/infrastructure/MongoRiskForecastRepository.js";
import { makeAppAlert, startApp } from "./support.js";

/**
 * routes/analyticsRoutes.ts に 1:1 対応。
 * GET /analytics（集計）。外部依存なし＝Mongo の集計を素通しで検証する。
 */
describe("analyticsRoutes (integration)", () => {
  let app: BackofficeApp;
  let alertRepository: MongoAlertRepository;
  let mongo: MongoClient;

  beforeAll(async () => {
    const started = await startApp();
    app = started.app;
    mongo = started.mongo;
    alertRepository = new MongoAlertRepository(started.mongo);
  });

  afterAll(async () => {
    await app?.stop();
  });

  it("GET /analytics は seed 件数を反映した totalAlerts を返す", async () => {
    await alertRepository.save(makeAppAlert(randomUUID()));
    await alertRepository.save(makeAppAlert(randomUUID()));

    const res = await request(app.httpApp).get("/analytics");

    expect(res.status).toBe(200);
    expect(typeof res.body.totalAlerts).toBe("number");
    expect(res.body.totalAlerts).toBeGreaterThanOrEqual(2);
    // 昇格（結晶化）パターン数はバリューストリップの成果指標として同梱する
    expect(typeof res.body.promotedPatternCount).toBe("number");
  });

  it("GET /analytics は保存済み報告書の引用照合率を返す（未照合は分母に残す）", async () => {
    const before = await request(app.httpApp).get("/analytics");

    const report = InvestigationReport.fromPrimitives({
      summary: "接続プールが枯渇",
      confidence: 0.75,
      severity: "CRITICAL",
      investigationSteps: [],
      suggestedActions: [],
      suggestedPatternName: "DB_CONNECTION_POOL_EXHAUSTED",
      reviewStatus: "PENDING_REVIEW",
      investigatedAt: "2026-01-01T00:01:00.000Z",
      isFallback: false,
      impact: {
        fault: "own",
        scope: "決済 API",
        scale: "エラー率 12%",
        affectedSubjects: ["checkout"],
        citations: ["module.db.instance", "PR #999"],
        citationRefs: [
          { value: "module.db.instance", kind: "terraform" },
          { value: "PR #999" }, // 未照合＝分母には残るが分子には入らない
        ],
      },
    });
    await alertRepository.save(
      makeAppAlert(randomUUID()).attachInvestigationReport(report),
    );

    const after = await request(app.httpApp).get("/analytics");

    const d = (res: request.Response) => res.body.citationCoverage;
    expect(d(after).total - d(before).total).toBe(2);
    expect(d(after).resolved - d(before).resolved).toBe(1);
    expect(d(after).byKind).toContainEqual({ kind: "terraform", count: 1 });
  });

  it("却下 → 再調査 → 承認 の判定履歴が Mongo を往復しても母数が 2 増える", async () => {
    // 分母が縮まないことは Mongo の doc に履歴が載って初めて成立する（ADR-29）。
    // 他テストと DB を共有するので、絶対値でなく差分で見る。
    const before = await request(app.httpApp).get("/analytics");

    const reviewed = makeAppAlert(randomUUID())
      .submitFeedback({ isCorrect: false, operatorNote: "原因が違う" })
      .reopenForReinvestigation()
      .submitFeedback({ isCorrect: true });
    await alertRepository.save(reviewed);

    const after = await request(app.httpApp).get("/analytics");

    expect(after.body.withFeedbackCount - before.body.withFeedbackCount).toBe(2);
    expect(after.body.correctCount - before.body.correctCount).toBe(1);
    expect(after.body.incorrectCount - before.body.incorrectCount).toBe(1);
  });

  it("GET /analytics は予報の測定を診断側とは別フィールドで返す（E6）", async () => {
    const before = await request(app.httpApp).get("/analytics");
    // 予報履歴を直接1件積む（生成経路は forecastRoutes 側のテストが持つ）。
    // 破棄済みでも標本に残ることを含めて、集計が履歴から出ていることを見る。
    const store = new MongoRiskForecastRepository(mongo);
    await store.append({
      forecast: {
        forecastId: randomUUID(),
        generatedAt: new Date("2026-08-04T00:00:00.000Z"),
        horizon: "今週末",
        risks: [
          {
            window: "土 20:00",
            subject: "db.connection_pool",
            level: "MEDIUM",
            confidence: 0.6,
            citations: ["chg-1"], // 過去インシデントの引用なし＝前例ゼロで出た側
            reasoning: "プール縮小とセールが重なる",
          },
        ],
        isFallback: false,
        verification: {
          citationsEmitted: 3,
          citationsDropped: 1,
          risksEmitted: 2,
          risksDropped: 1,
        },
      },
      signals: [
        {
          id: "chg-1",
          kind: "FUTURE_CHANGE",
          subject: "db.connection_pool",
          when: "未マージ",
          desc: "max_connections 縮小",
          source: "github.pr#55",
        },
        {
          id: "inc-1",
          kind: "MEMORY",
          subject: "db.connection_pool",
          when: "過去の解決済みインシデント",
          desc: "枯渇 → 上限拡大で解消",
          source: "incident.alert-1",
        },
      ],
    });
    await store.clear(); // デモ卓のリセット相当。標本は消えない

    const res = await request(app.httpApp).get("/analytics");

    const m = res.body.forecastMeasurement;
    expect(m.forecasts).toBe(1);
    expect(m.citationsEmitted).toBe(3);
    expect(m.citationsDropped).toBe(1);
    expect(m.risksDropped).toBe(1);
    expect(m.signalsCollected).toBe(2);
    expect(m.signalsByKind).toEqual([
      { kind: "FUTURE_CHANGE", count: 1 },
      { kind: "MEMORY", count: 1 },
    ]);
    // 前例（MEMORY）を引用していないリスクが MEDIUM で出た＝「弱く出る」の実測形
    expect(m.byLevel).toEqual([
      { level: "HIGH", count: 0, withMemoryCitation: 0 },
      { level: "MEDIUM", count: 1, withMemoryCitation: 0 },
      { level: "LOW", count: 0, withMemoryCitation: 0 },
    ]);
    // 診断側（引用照合率）は予報を1件積んでも動かない＝分母の意味が違う数字が混ざっていない。
    // 混ざると「予報側は定義上 100%」が診断側の率を押し上げる（→ ADR-30 と同じ罠）。
    expect(res.body.citationCoverage).toEqual(before.body.citationCoverage);
  });
});
