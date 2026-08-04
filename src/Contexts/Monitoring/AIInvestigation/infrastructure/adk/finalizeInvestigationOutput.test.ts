import { describe, it, expect } from "vitest";
import { finalizeInvestigationOutput } from "./finalizeInvestigationOutput.js";
import type {
  InvestigationFinalizer,
  InvestigationTranscript,
} from "./InvestigationFinalizer.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { StructuredLog } from "../../../../Shared/domain/logging/StructuredLog.js";

class RecordingLogger extends Logger {
  logs: StructuredLog[] = [];
  async write(log: StructuredLog): Promise<void> {
    this.logs.push(log);
  }
}

class FakeFinalizer implements InvestigationFinalizer {
  calls = 0;
  lastTranscript: InvestigationTranscript | undefined;
  constructor(private readonly behavior: { text?: string; error?: Error }) {}
  async finalize(transcript: InvestigationTranscript): Promise<string> {
    this.calls++;
    this.lastTranscript = transcript;
    if (this.behavior.error) throw this.behavior.error;
    return this.behavior.text ?? "";
  }
}

const validJson = JSON.stringify({
  summary: "DB接続枯渇",
  confidence: 0.87,
  severity: "CRITICAL",
  investigationSteps: ["ログ確認"],
  suggestedActions: ["プール拡張"],
  suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
});

const draftJson = JSON.stringify({
  summary: "コーディネーターの下書き",
  confidence: 0.5,
  severity: "WARNING",
  investigationSteps: [],
  suggestedActions: [],
  suggestedPatternName: "DRAFT",
});

function transcript(
  overrides: Partial<InvestigationTranscript> = {},
): InvestigationTranscript {
  return {
    seedPrompt: "{}",
    subAgentOutputs: [{ agent: "root_cause_analyst", output: "接続プール枯渇" }],
    coordinatorFinalText: draftJson,
    ...overrides,
  };
}

describe("finalizeInvestigationOutput", () => {
  it("finalizer 未注入なら清書せずコーディネーターの下書きを返す（既存挙動を変えない）", async () => {
    const logger = new RecordingLogger();

    const outcome = await finalizeInvestigationOutput({
      transcript: transcript(),
      logger,
    });

    expect(outcome.source).toBe("coordinator");
    expect(outcome.text).toBe(draftJson);
    expect(logger.logs).toHaveLength(0);
  });

  it("清書がパースを通れば finalizer の出力を採用する", async () => {
    const finalizer = new FakeFinalizer({ text: validJson });

    const outcome = await finalizeInvestigationOutput({
      finalizer,
      transcript: transcript(),
      logger: new RecordingLogger(),
    });

    expect(outcome.source).toBe("finalizer");
    expect(outcome.text).toBe(validJson);
    expect(finalizer.calls).toBe(1);
  });

  it("コーディネーターが空応答でも、サブエージェント出力から清書できれば復帰する（第6原因の本命ケース）", async () => {
    const finalizer = new FakeFinalizer({ text: validJson });

    const outcome = await finalizeInvestigationOutput({
      finalizer,
      transcript: transcript({ coordinatorFinalText: "" }),
      logger: new RecordingLogger(),
    });

    expect(outcome.source).toBe("finalizer");
    expect(outcome.text).toBe(validJson);
    // 空応答でもサブエージェントの調査結果は清書役へ渡っていること（これが復帰の材料）
    expect(finalizer.lastTranscript?.subAgentOutputs).toHaveLength(1);
  });

  it("清書が例外なら下書きへ縮退し、理由を Cloud Logging に残す", async () => {
    const logger = new RecordingLogger();

    const outcome = await finalizeInvestigationOutput({
      finalizer: new FakeFinalizer({ error: new Error("finalizer timeout") }),
      transcript: transcript(),
      logger,
    });

    expect(outcome.source).toBe("coordinator");
    expect(outcome.text).toBe(draftJson);
    expect(logger.logs.map((l) => l.action)).toContain(
      "ai_investigation_finalizer_failed",
    );
  });

  it("清書がパース不能なら下書きへ縮退する（生成側の主張を鵜呑みにしない）", async () => {
    const logger = new RecordingLogger();

    const outcome = await finalizeInvestigationOutput({
      finalizer: new FakeFinalizer({ text: "清書に失敗しました" }),
      transcript: transcript(),
      logger,
    });

    expect(outcome.source).toBe("coordinator");
    expect(outcome.text).toBe(draftJson);
    expect(logger.logs.map((l) => l.action)).toContain(
      "ai_investigation_finalizer_unusable",
    );
  });

  it("清書が空文字でも下書きへ縮退する（空を採用して fallback に落とさない）", async () => {
    const outcome = await finalizeInvestigationOutput({
      finalizer: new FakeFinalizer({ text: "" }),
      transcript: transcript(),
      logger: new RecordingLogger(),
    });

    expect(outcome.source).toBe("coordinator");
    expect(outcome.text).toBe(draftJson);
  });

  it("清書も下書きも使えない場合は下書き（空）を返す＝縮退リトライ・fallback は従来どおり後段が受ける", async () => {
    const outcome = await finalizeInvestigationOutput({
      finalizer: new FakeFinalizer({ text: "" }),
      transcript: transcript({ coordinatorFinalText: "" }),
      logger: new RecordingLogger(),
    });

    expect(outcome.source).toBe("coordinator");
    expect(outcome.text).toBe("");
  });
});
