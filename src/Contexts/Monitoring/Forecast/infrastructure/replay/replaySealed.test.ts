import { describe, expect, it } from "vitest";
import { StubLLMClient } from "../../../AIInvestigation/infrastructure/aiinvestigation/StubLLMClient.js";
import { LLMTextClient } from "../../../AIInvestigation/domain/LLMTextClient.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { StructuredLog } from "../../../../Shared/domain/logging/StructuredLog.js";
import { captureEvidenceSnapshot } from "../../domain/EvidenceSnapshot.js";
import { ForecastContext } from "../../domain/ForecastContext.js";
import { ForecastSignal, ForecastSignalKind } from "../../domain/ForecastSignal.js";
import { GeminiForecastAdapter } from "../GeminiForecastAdapter.js";
import { ForecastSynthesis } from "../../application/ForecastRisk/ForecastSynthesis.js";
import { ALLOW_NONE, ReplayNetworkBlockedError } from "./ReplayNetworkGuard.js";
import { replaySealed } from "./replaySealed.js";

class SilentLogger extends Logger {
  async write(_log: StructuredLog): Promise<void> {}
}

const signal = (id: string, kind: ForecastSignal["kind"], subject: string): ForecastSignal => ({
  id,
  kind,
  subject,
  when: "土 20:00-23:00",
  desc: `${id} の中身`,
  source: `seed.${id}`,
});

// StubLLMClient の固定予報が引用する id を揃えた入力（plan-1/plan-2/sch-1/inc-1/inc-3/inc-4）。
const context: ForecastContext = {
  horizon: "今週末",
  signals: [
    signal("plan-1", ForecastSignalKind.FUTURE_CHANGE, "db_connection_pool"),
    signal("plan-2", ForecastSignalKind.FUTURE_CHANGE, "valkey_cache"),
    signal("sch-1", ForecastSignalKind.SCHEDULE, "checkout"),
    signal("inc-1", ForecastSignalKind.MEMORY, "db_connection_pool"),
    signal("inc-3", ForecastSignalKind.MEMORY, "valkey_cache"),
    signal("inc-4", ForecastSignalKind.MEMORY, "valkey_cache"),
  ],
};

const levels = (risks: { subject: string; level: string }[]) =>
  risks.map((risk) => `${risk.subject}=${risk.level}`);

describe("replaySealed", () => {
  it("保存済み snapshot から再実行すると、同じ予報器（stub）なら元の実行と同じ level が出る", async () => {
    const logger = new SilentLogger();
    const port = new GeminiForecastAdapter(new StubLLMClient(), logger);
    const original = await new ForecastSynthesis(port, logger).forecast(context);
    const snapshot = captureEvidenceSnapshot(context, new Date("2026-09-26T00:00:00.000Z"));

    const first = await replaySealed({ snapshot, forecastPort: port, logger, allow: ALLOW_NONE });
    const second = await replaySealed({ snapshot, forecastPort: port, logger, allow: ALLOW_NONE });

    expect(original.risks.length).toBeGreaterThan(0);
    expect(levels(first.risks)).toEqual(levels(original.risks));
    expect(levels(second.risks)).toEqual(levels(original.risks));
    expect(first.verification).toEqual(original.verification);
  });

  it("リプレイ中に外部通信を試みると、予報器が例外を握りつぶしても ReplayNetworkBlockedError で落ちる", async () => {
    // 予報器の中から証拠を取りに行く（本来してはいけない）実装。GeminiForecastAdapter は
    // LLM 例外を fallback に畳むので、例外だけでは気づけない＝violations で落とせることを確かめる。
    const sneaky: LLMTextClient = {
      async generate() {
        await fetch("https://api.github.com/repos/elastic/kibana/pulls/1");
        return "{}";
      },
    };
    const logger = new SilentLogger();
    const snapshot = captureEvidenceSnapshot(context, new Date("2026-09-26T00:00:00.000Z"));

    await expect(
      replaySealed({
        snapshot,
        forecastPort: new GeminiForecastAdapter(sneaky, logger),
        logger,
        allow: ALLOW_NONE,
      }),
    ).rejects.toThrow(ReplayNetworkBlockedError);
  });
});
