import { describe, it, expect, beforeAll } from "vitest";
import { BACKOFFICE_BASE_URL, resetDemo } from "./support.js";

/**
 * 【予兆フラッグシップ（F8）E2E】POST /forecast → GET /forecast の契約回帰テスト。
 *
 * e2e overlay（docker-compose.e2e.yml）の AI_INVESTIGATION_STUB=true により
 * StubLLMClient が固定予報 JSON（偽引用 ghost-* 入り）を返すため、Gemini 課金・
 * 非決定性なしで次を実プロセス越しに検証する:
 *  - フラッグシップ seed の収集: pending plan（plan-1）・schedule（sch-1）・
 *    demo reset が seed した過去解決事例からの MEMORY シグナル
 *  - 引用検証（ハルシネーション・ガード）: 偽引用 ghost-1 は citations から落ち、
 *    裏付けゼロのリスク（ghost-2 のみ）は丸ごと破棄される
 *  - MEMORY 引用の実在解決: incident.<AlertId> が GET /alerts/:id で本当に開ける
 *  - GET は事前生成済みキャッシュをそのまま返す（審査員の無人閲覧経路）
 */

// ResolvedAlertSeed の FORECAST_MEMORY_SEED_ALERT_IDS と同値（e2e は src を import しない）。
const MEMORY_SEED_ALERT_IDS = [
  "5eed0000-0000-4000-8000-000000000002", // 過去のバックボーンVM縮小→枯渇（pending plan と同 subject）
  "5eed0000-0000-4000-8000-000000000003", // 週末セール checkout 負荷（schedule seed と同 subject）
  "5eed0000-0000-4000-8000-000000000004", // 過去の Valkey TTL 短縮→枯渇（Valkey plan-2 と同 subject）
  "5eed0000-0000-4000-8000-000000000005", // 過去の Valkey メモリ縮小→枯渇（Valkey plan-2 と同 subject）
];

type ForecastSignal = {
  id: string;
  kind: "FUTURE_CHANGE" | "SCHEDULE" | "MEMORY";
  subject: string;
  source: string;
};

type ForecastResponse = {
  forecast: {
    forecastId: string;
    isFallback: boolean;
    risks: {
      subject: string;
      level: string;
      citations: string[];
      preventiveAction?: string;
    }[];
  };
  signals: ForecastSignal[];
};

async function postForecast(): Promise<ForecastResponse> {
  const res = await fetch(`${BACKOFFICE_BASE_URL}/forecast`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`POST /forecast failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ForecastResponse;
}

describe("backoffice E2E: 予兆ブリーフィング（フラッグシップ seed × 引用検証）", () => {
  let generated: ForecastResponse;

  beforeAll(async () => {
    // MEMORY の投影元（解決済みアーカイブ Alert）を seed する。生成時に再 warmUp されるため
    // backend の再起動は不要（reset → POST の順だけ守ればよい＝デモ卓と同じ手順）。
    await resetDemo();
    generated = await postForecast();
  });

  it("2シナリオ分のシグナル（plan-1/plan-2 / schedule / MEMORY 4件）が収集される", () => {
    const ids = generated.signals.map((s) => s.id);
    expect(ids).toContain("plan-1"); // pending plan seed（バックボーンVM e2-standard-2→e2-small 縮小）
    expect(ids).toContain("plan-2"); // U2: Valkey maxmemory 4GB→2GB 縮小（合成 seed）
    expect(ids).toContain("sch-1"); // schedule seed（土20:00 checkout 負荷x5）

    // MEMORY: reset が seed した過去解決事例が subject 突合で記憶として載る（backbone×2 + valkey×2）
    const memorySources = generated.signals
      .filter((s) => s.kind === "MEMORY")
      .map((s) => s.source);
    for (const alertId of MEMORY_SEED_ALERT_IDS) {
      expect(memorySources).toContain(`incident.${alertId}`);
    }
  });

  it("引用検証: 偽引用は落ち、裏付けゼロのリスクは破棄される（stub は ghost-* を混ぜて返す）", () => {
    expect(generated.forecast.isFallback).toBe(false);
    // stub は3リスク返すが、ghost-2 のみのリスクは丸ごと破棄され2件になる（flagship + Valkey）。
    // 並びは level 降順→confidence 降順＝flagship(0.78) が先、Valkey(0.72) が後。
    expect(generated.forecast.risks).toHaveLength(2);

    const flagship = generated.forecast.risks[0];
    expect(flagship.level).toBe("HIGH");
    // ghost-1（偽引用）だけが citations から落ち、実在シグナルの引用は残る。
    // inc-1（MEMORY 先頭）が残る＝記憶 seed が引けている検証を兼ねる（引けなければ偽引用扱いで落ちて赤くなる）。
    expect(flagship.citations).toEqual(["plan-1", "sch-1", "inc-1"]);
    // F11a: 先手1行が adapter → 引用検証 → wire 変換を通って配信まで届く
    expect(flagship.preventiveAction).toContain("[STUB]");

    // U2: Valkey カスケード。plan-2 と Valkey 記憶（inc-3/inc-4）が引けている検証を兼ねる。
    const valkey = generated.forecast.risks[1];
    expect(valkey.level).toBe("HIGH");
    expect(valkey.citations).toEqual(["plan-2", "sch-1", "inc-3", "inc-4"]);
    expect(valkey.preventiveAction).toContain("[STUB]");
  });

  it("MEMORY 引用は実在の解決済み Alert に解決できる（GET /alerts/:id が開ける）", async () => {
    const memorySignal = generated.signals.find(
      (s) => s.source === `incident.${MEMORY_SEED_ALERT_IDS[0]}`,
    );
    expect(memorySignal).toBeDefined();

    const alertId = memorySignal!.source.replace(/^incident\./, "");
    const res = await fetch(`${BACKOFFICE_BASE_URL}/alerts/${alertId}`);
    expect(res.status).toBe(200);
  });

  it("GET /forecast は事前生成済みの最新予報をそのまま返す（再生成しない・無人閲覧経路）", async () => {
    const res = await fetch(`${BACKOFFICE_BASE_URL}/forecast`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ForecastResponse;
    expect(body.forecast.forecastId).toBe(generated.forecast.forecastId);
  });
});
