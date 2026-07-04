import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "@shared/api/HttpClient";
import { HttpError } from "@shared/api/HttpClient";
import type { ForecastBriefingPrimitives } from "@monitoring/Forecast/domain/contracts/ForecastContract";
import { createForecastApi } from "./forecastApi";
import { triggerForecast } from "../application/triggerForecast";

const DTO: ForecastBriefingPrimitives = {
  forecast: {
    forecastId: "f-1",
    generatedAt: "2026-07-03T10:00:00.000Z",
    horizon: "今週末",
    risks: [
      {
        window: "土曜 20:00",
        subject: "db.connection_pool",
        level: "HIGH",
        confidence: 0.8,
        citations: ["sig-1"],
        reasoning: "縮小 PR と負荷が重なる",
      },
    ],
    isFallback: false,
  },
  signals: [
    {
      id: "sig-1",
      kind: "FUTURE_CHANGE",
      subject: "db.connection_pool",
      when: "マージ後",
      desc: "pool 縮小 PR",
      source: "github.pr.42",
    },
  ],
};

function httpMock(over: Partial<HttpClient>): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    ...over,
  };
}

describe("createForecastApi.getLatest", () => {
  it("200 は ready＋View 写像で返す", async () => {
    const api = createForecastApi(
      httpMock({ get: vi.fn().mockResolvedValue(DTO) }),
    );
    const snapshot = await api.getLatest();
    expect(snapshot.kind).toBe("ready");
    if (snapshot.kind === "ready") {
      expect(snapshot.briefing.risks[0].citations[0].subject).toBe(
        "db.connection_pool",
      );
    }
  });

  it("404＋JSON body（キャッシュ未生成）は empty", async () => {
    const api = createForecastApi(
      httpMock({
        get: vi
          .fn()
          .mockRejectedValue(
            new HttpError(404, "Not Found", { error: "予報はまだ生成されていません" }),
          ),
      }),
    );
    await expect(api.getLatest()).resolves.toEqual({ kind: "empty" });
  });

  it("404＋非 JSON body（forecastGuard）は disabled", async () => {
    const api = createForecastApi(
      httpMock({
        get: vi
          .fn()
          .mockRejectedValue(new HttpError(404, "Not Found", "Not Found")),
      }),
    );
    await expect(api.getLatest()).resolves.toEqual({ kind: "disabled" });
  });

  it("404 以外のエラーはそのまま伝播する", async () => {
    const boom = new HttpError(500, "Internal Server Error", undefined);
    const api = createForecastApi(
      httpMock({ get: vi.fn().mockRejectedValue(boom) }),
    );
    await expect(api.getLatest()).rejects.toBe(boom);
  });
});

describe("generate / triggerForecast", () => {
  it("POST /forecast の結果を View で返す（長めのタイムアウト指定）", async () => {
    const post = vi.fn().mockResolvedValue(DTO);
    const api = createForecastApi(httpMock({ post }));
    const view = await triggerForecast(api);
    expect(view.risks[0].level).toBe("HIGH");
    expect(post).toHaveBeenCalledWith(
      "/forecast",
      undefined,
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
  });

  it("DEMO_ENABLED off の 404 は呼び出し側へ伝播する", async () => {
    const denied = new HttpError(404, "Not Found", "Not Found");
    const api = createForecastApi(
      httpMock({ post: vi.fn().mockRejectedValue(denied) }),
    );
    await expect(triggerForecast(api)).rejects.toBe(denied);
  });
});

describe("reset（F12）", () => {
  it("DELETE /forecast を呼ぶ", async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const api = createForecastApi(httpMock({ delete: del }));
    await api.reset();
    expect(del).toHaveBeenCalledWith("/forecast", expect.anything());
  });

  it("DEMO_ENABLED off の 404 は呼び出し側へ伝播する", async () => {
    const denied = new HttpError(404, "Not Found", "Not Found");
    const api = createForecastApi(
      httpMock({ delete: vi.fn().mockRejectedValue(denied) }),
    );
    await expect(api.reset()).rejects.toBe(denied);
  });
});
