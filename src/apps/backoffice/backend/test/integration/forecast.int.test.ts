import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { MongoClient } from "mongodb";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { ForecastContext } from "../../../../../Contexts/Monitoring/Forecast/domain/ForecastContext.js";
import { ForecastPort } from "../../../../../Contexts/Monitoring/Forecast/domain/ForecastPort.js";
import { RiskForecast } from "../../../../../Contexts/Monitoring/Forecast/domain/RiskForecast.js";
import { startApp } from "./support.js";

/**
 * routes/forecastRoutes.ts に 1:1 対応。GET /forecast / POST /forecast。
 * Gemini は叩かない＝forecastPort を決定的 fake に差し替え、Handler の引用検証
 * （偽引用 drop）とキャッシュ配信（GET は事前生成済みを返す）を HTTP 境界で検証する。
 * シグナルは DEMO_ENABLED=true のスケジュール seed（sch-1・checkout）が決定的に入る
 * （GitHub/Terraform は int 環境では未設定＝空縮退）。
 * （FORECAST_ENABLED=true は vitest.integration.config.ts で設定済み＝forecastGuard を通す。）
 */
describe("forecastRoutes (integration)", () => {
  let app: BackofficeApp;
  let mongo: MongoClient;

  // 実在する sch-1 と偽引用 ghost-9 を混ぜ、引用ゼロのリスクも出す fake（引用検証の実演）。
  const forecastPort: ForecastPort = {
    async forecast(context: ForecastContext): Promise<RiskForecast> {
      return {
        forecastId: "forecast-int-1",
        generatedAt: new Date("2026-07-03T12:00:00.000Z"),
        horizon: context.horizon,
        risks: [
          {
            window: "土 20:00-23:00",
            subject: "checkout",
            level: "HIGH",
            confidence: 0.85,
            citations: ["sch-1", "ghost-9"],
            reasoning: "週末セール負荷とプール縮小が重なるため。",
            preventiveAction: "縮小 plan の適用をセール後へ延期する。",
          },
          {
            window: "日中",
            subject: "uncited",
            level: "MEDIUM",
            confidence: 0.5,
            citations: [],
            reasoning: "裏付けなし（drop されるべき）。",
          },
        ],
        isFallback: false,
      };
    },
  };

  beforeAll(async () => {
    const started = await startApp({ forecastPort });
    app = started.app;
    mongo = started.mongo;
  });

  afterAll(async () => {
    await app?.stop();
  });

  it("GET /forecast は生成前なら 404（事前生成済みキャッシュが無い）", async () => {
    const res = await request(app.httpApp).get("/forecast");
    expect(res.status).toBe(404);
  });

  it("POST /forecast は引用検証済みの予報を生成して返す（偽引用・裏付けゼロは drop）", async () => {
    const res = await request(app.httpApp).post("/forecast").send();

    expect(res.status).toBe(200);
    expect(res.body.forecast.forecastId).toBe("forecast-int-1");
    expect(res.body.forecast.horizon).toBe("今週末"); // config 既定
    expect(res.body.forecast.isFallback).toBe(false);
    // 引用検証: ghost-9 は落ち sch-1 のみ残る。citations 空のリスクは丸ごと落ちる。
    expect(res.body.forecast.risks).toHaveLength(1);
    expect(res.body.forecast.risks[0].subject).toBe("checkout");
    expect(res.body.forecast.risks[0].citations).toEqual(["sch-1"]);
    // F11a: 先手は引用検証（spread）と wire 変換（明示マッピング）を通って配信まで届く。
    expect(res.body.forecast.risks[0].preventiveAction).toBe(
      "縮小 plan の適用をセール後へ延期する。",
    );
    // 引用チップの解決先＝シグナル全量が同梱される（スケジュール seed 由来の sch-1）。
    expect(res.body.signals).toContainEqual(
      expect.objectContaining({ id: "sch-1", kind: "SCHEDULE", subject: "checkout" }),
    );
  });

  it("GET /forecast は事前生成済みの最新予報をそのまま返す（再生成しない）", async () => {
    const res = await request(app.httpApp).get("/forecast");

    expect(res.status).toBe(200);
    expect(res.body.forecast.forecastId).toBe("forecast-int-1");
    expect(res.body.forecast.generatedAt).toBe("2026-07-03T12:00:00.000Z");
    expect(res.body.forecast.risks[0].citations).toEqual(["sch-1"]);
  });

  it("POST を重ねると予報は上書きされず Mongo に追記される（履歴＝測定の標本）", async () => {
    await request(app.httpApp).post("/forecast").send();

    expect(await mongo.db().collection("risk_forecasts").countDocuments({})).toBe(2);
    // 追記しても配信は最新1件のまま＝ GET /forecast の形は不変。
    const res = await request(app.httpApp).get("/forecast");
    expect(res.status).toBe(200);
    expect(res.body.forecast.forecastId).toBe("forecast-int-1");
  });

  it("POST /demo/reset は予報を巻き込まない（提出前に温めたキャッシュを守る設計）", async () => {
    const reset = await request(app.httpApp).post("/demo/reset").send();
    expect(reset.status).toBe(200);

    const res = await request(app.httpApp).get("/forecast");
    expect(res.status).toBe(200);
    expect(await mongo.db().collection("risk_forecasts").countDocuments({})).toBe(2);
  });

  it("DELETE /forecast は生成済み予報を破棄し、GET が未生成（404）に戻る（F12）", async () => {
    const del = await request(app.httpApp).delete("/forecast");
    expect(del.status).toBe(204);

    const res = await request(app.httpApp).get("/forecast");
    expect(res.status).toBe(404);
    // 未生成状態に戻るのは配信だけで、生成履歴は残す（デモ卓のリセットで標本を失わない）。
    expect(await mongo.db().collection("risk_forecasts").countDocuments({})).toBe(2);
  });
});
