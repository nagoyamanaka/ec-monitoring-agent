import { describe, it, expect } from "vitest";
import {
  GeminiForecastAdapter,
  buildForecastPrompt,
  parseForecastOutput,
} from "./GeminiForecastAdapter.js";
import { ForecastContext } from "../domain/ForecastContext.js";
import { ForecastSignal, ForecastSignalKind } from "../domain/ForecastSignal.js";
import { LLMTextClient } from "../../AIInvestigation/domain/LLMTextClient.js";
import { StubLLMClient } from "../../AIInvestigation/infrastructure/aiinvestigation/StubLLMClient.js";
import { Logger } from "../../../Shared/domain/logging/Logger.js";
import { StructuredLog } from "../../../Shared/domain/logging/StructuredLog.js";

const signals: ForecastSignal[] = [
  {
    id: "chg-1",
    kind: ForecastSignalKind.FUTURE_CHANGE,
    subject: "db_connection_pool",
    when: "未マージ（merge され次第有効）",
    desc: "max_connections 100→40 に縮小",
    source: "github.pr#123",
    url: "https://github.com/example/repo/pull/123",
  },
  {
    id: "sch-1",
    kind: ForecastSignalKind.SCHEDULE,
    subject: "checkout",
    when: "土 20:00-23:00",
    desc: "セール負荷 x5",
    source: "schedule.seed",
  },
];

const context: ForecastContext = { horizon: "今週末", signals };

class FakeLLMClient implements LLMTextClient {
  lastSystemInstruction = "";
  lastPrompt = "";
  constructor(private readonly behavior: () => Promise<string>) {}
  async generate(systemInstruction: string, prompt: string): Promise<string> {
    this.lastSystemInstruction = systemInstruction;
    this.lastPrompt = prompt;
    return this.behavior();
  }
}

class RecordingLogger extends Logger {
  logs: StructuredLog[] = [];
  async write(log: StructuredLog): Promise<void> {
    this.logs.push(log);
  }
}

const riskJson = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    risks: [
      {
        window: "土 20:00-23:00",
        subject: "db_connection_pool",
        level: "HIGH",
        confidence: 0.8,
        citations: ["chg-1", "sch-1"],
        reasoning: "接続数縮小とセール負荷が同時に重なるため。",
        ...overrides,
      },
    ],
  });

describe("GeminiForecastAdapter", () => {
  it("正常なJSON応答を RiskForecast に変換する", async () => {
    const adapter = new GeminiForecastAdapter(new FakeLLMClient(async () => riskJson()));
    const forecast = await adapter.forecast(context);

    expect(forecast.isFallback).toBe(false);
    expect(forecast.horizon).toBe("今週末");
    expect(forecast.forecastId).not.toBe("");
    expect(forecast.risks).toHaveLength(1);
    expect(forecast.risks[0]).toEqual({
      window: "土 20:00-23:00",
      subject: "db_connection_pool",
      level: "HIGH",
      confidence: 0.8,
      citations: ["chg-1", "sch-1"],
      reasoning: "接続数縮小とセール負荷が同時に重なるため。",
    });
  });

  it("```json フェンス付き応答もパースできる", async () => {
    const adapter = new GeminiForecastAdapter(
      new FakeLLMClient(async () => "```json\n" + riskJson() + "\n```"),
    );
    const forecast = await adapter.forecast(context);
    expect(forecast.isFallback).toBe(false);
    expect(forecast.risks).toHaveLength(1);
  });

  it("プロンプトに horizon と全シグナル id を含める（url は含めない）", async () => {
    const llm = new FakeLLMClient(async () => riskJson());
    await new GeminiForecastAdapter(llm).forecast(context);

    expect(llm.lastPrompt).toContain("今週末");
    expect(llm.lastPrompt).toContain("chg-1");
    expect(llm.lastPrompt).toContain("sch-1");
    expect(llm.lastPrompt).not.toContain("https://github.com");
    expect(llm.lastSystemInstruction).toContain("citations");
  });

  it("confidence を [0,1] にクランプし、非数値は 0 に丸める", async () => {
    const raw = JSON.stringify({
      risks: [
        {
          window: "w",
          subject: "a",
          level: "LOW",
          confidence: 1.5,
          citations: ["chg-1"],
          reasoning: "r",
        },
        {
          window: "w",
          subject: "b",
          level: "LOW",
          confidence: -0.2,
          citations: ["chg-1"],
          reasoning: "r",
        },
        {
          window: "w",
          subject: "c",
          level: "LOW",
          confidence: "high",
          citations: ["chg-1"],
          reasoning: "r",
        },
      ],
    });
    const forecast = await new GeminiForecastAdapter(new FakeLLMClient(async () => raw)).forecast(
      context,
    );
    expect(forecast.risks.map((r) => r.confidence)).toEqual([1, 0, 0]);
  });

  it("未知の level は LOW に丸め、level 降順（同 level は confidence 降順）に並べる", async () => {
    const raw = JSON.stringify({
      risks: [
        { window: "w", subject: "a", level: "LOW", confidence: 0.9, citations: ["chg-1"], reasoning: "r" },
        { window: "w", subject: "b", level: "EXTREME", confidence: 0.2, citations: ["chg-1"], reasoning: "r" },
        { window: "w", subject: "c", level: "HIGH", confidence: 0.5, citations: ["chg-1"], reasoning: "r" },
        { window: "w", subject: "d", level: "MEDIUM", confidence: 0.5, citations: ["chg-1"], reasoning: "r" },
      ],
    });
    const forecast = await new GeminiForecastAdapter(new FakeLLMClient(async () => raw)).forecast(
      context,
    );
    expect(forecast.risks.map((r) => [r.subject, r.level])).toEqual([
      ["c", "HIGH"],
      ["d", "MEDIUM"],
      ["a", "LOW"],
      ["b", "LOW"],
    ]);
  });

  it("必須フィールド欠落の要素は落とし、citations は文字列のみ・空白除去で正規化する", async () => {
    const raw = JSON.stringify({
      risks: [
        { window: "w", subject: "", level: "HIGH", confidence: 0.5, citations: ["chg-1"], reasoning: "r" },
        { window: 3, subject: "a", level: "HIGH", confidence: 0.5, citations: ["chg-1"], reasoning: "r" },
        "not-an-object",
        {
          window: "w",
          subject: "ok",
          level: "HIGH",
          confidence: 0.5,
          citations: ["chg-1", 42, "  ", "sch-1"],
          reasoning: "r",
        },
      ],
    });
    const forecast = await new GeminiForecastAdapter(new FakeLLMClient(async () => raw)).forecast(
      context,
    );
    expect(forecast.risks).toHaveLength(1);
    expect(forecast.risks[0].subject).toBe("ok");
    expect(forecast.risks[0].citations).toEqual(["chg-1", "sch-1"]);
  });

  it("リスク無し（risks: []）は空の正常予報として返す（fallback ではない）", async () => {
    const forecast = await new GeminiForecastAdapter(
      new FakeLLMClient(async () => JSON.stringify({ risks: [] })),
    ).forecast(context);
    expect(forecast.isFallback).toBe(false);
    expect(forecast.risks).toEqual([]);
  });

  it("LLM 例外時は fallback（isFallback=true・risks 空）を返しログに残す", async () => {
    const logger = new RecordingLogger();
    const adapter = new GeminiForecastAdapter(
      new FakeLLMClient(async () => {
        throw new Error("Gemini timeout");
      }),
      logger,
    );
    const forecast = await adapter.forecast(context);

    expect(forecast.isFallback).toBe(true);
    expect(forecast.risks).toEqual([]);
    expect(forecast.horizon).toBe("今週末");
    expect(logger.logs).toHaveLength(1);
    expect(logger.logs[0].action).toBe("forecast_generation_failed");
    expect(logger.logs[0].message).toContain("Gemini timeout");
  });

  it("散文（JSONでない応答）は fallback とし、rawSnippet をログに残す", async () => {
    const logger = new RecordingLogger();
    const adapter = new GeminiForecastAdapter(
      new FakeLLMClient(async () => "今週末はDB接続枯渇のリスクが高いと考えられます。"),
      logger,
    );
    const forecast = await adapter.forecast(context);

    expect(forecast.isFallback).toBe(true);
    expect(logger.logs[0].action).toBe("forecast_unparseable");
    expect(logger.logs[0].message).toContain("rawSnippet=今週末はDB接続枯渇");
  });

  it("risks が配列でない応答は fallback とする", async () => {
    const logger = new RecordingLogger();
    const forecast = await new GeminiForecastAdapter(
      new FakeLLMClient(async () => JSON.stringify({ risks: "none" })),
      logger,
    ).forecast(context);
    expect(forecast.isFallback).toBe(true);
    expect(logger.logs[0].action).toBe("forecast_unparseable");
  });

  it("logger 未注入でも fallback 経路が無言で成立する", async () => {
    const forecast = await new GeminiForecastAdapter(
      new FakeLLMClient(async () => {
        throw new Error("boom");
      }),
    ).forecast(context);
    expect(forecast.isFallback).toBe(true);
  });
});

describe("parseForecastOutput / buildForecastPrompt（境界）", () => {
  it("途中切断された JSON は null（＝fallback へ）", () => {
    expect(parseForecastOutput(riskJson().slice(0, 60))).toBeNull();
  });

  it("プロンプトはシグナルの id/kind/subject/when/desc/source を JSON で列挙する", () => {
    const prompt = buildForecastPrompt(context);
    expect(prompt).toContain('"kind": "FUTURE_CHANGE"');
    expect(prompt).toContain('"desc": "max_connections 100→40 に縮小"');
  });
});

// ローカルE2E（AI_INVESTIGATION_STUB=true）の決定論経路: StubLLMClient は予兆の
// SYSTEM_INSTRUCTION を判別して固定予報 JSON を返す。ここで adapter 経由の契約
// （parse 可能・偽引用 ghost-* 入り＝引用検証の実演素材）を固定し、stub とパーサの乖離を防ぐ。
describe("GeminiForecastAdapter × StubLLMClient（E2E 決定論経路の契約）", () => {
  it("stub の固定予報を parse でき、偽引用 ghost-* を含む2リスクが得られる", async () => {
    const adapter = new GeminiForecastAdapter(new StubLLMClient());

    const forecast = await adapter.forecast(context);

    expect(forecast.isFallback).toBe(false);
    expect(forecast.risks).toHaveLength(2);
    expect(forecast.risks[0].level).toBe("HIGH");
    expect(forecast.risks[0].citations).toEqual([
      "plan-1",
      "sch-1",
      "inc-1",
      "ghost-1",
    ]);
    expect(forecast.risks[1].citations).toEqual(["ghost-2"]);
  });

  it("予兆以外の instruction には調査用の固定出力を返す（既存経路を汚さない）", async () => {
    const raw = await new StubLLMClient().generate("あなたはSREの調査AIです", "prompt");
    expect(JSON.parse(raw).summary).toContain("[STUB]");
  });
});
