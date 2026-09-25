import { parseArgs } from "node:util";
import { MongoClient } from "mongodb";
import { GeminiLLMClient } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/aiinvestigation/GeminiLLMClient.js";
import { StubLLMClient } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/aiinvestigation/StubLLMClient.js";
import { ForecastIssued } from "../../../../Contexts/Monitoring/Forecast/domain/ForecastLedger.js";
import { compareReplayWithLedger } from "../../../../Contexts/Monitoring/Forecast/domain/forecastReplay.js";
import { GeminiForecastAdapter } from "../../../../Contexts/Monitoring/Forecast/infrastructure/GeminiForecastAdapter.js";
import { MongoEvidenceSnapshotRepository } from "../../../../Contexts/Monitoring/Forecast/infrastructure/MongoEvidenceSnapshotRepository.js";
import { MongoForecastLedgerRepository } from "../../../../Contexts/Monitoring/Forecast/infrastructure/MongoForecastLedgerRepository.js";
import {
  ALLOW_NONE,
  HostAllowlist,
} from "../../../../Contexts/Monitoring/Forecast/infrastructure/replay/ReplayNetworkGuard.js";
import { replaySealed } from "../../../../Contexts/Monitoring/Forecast/infrastructure/replay/replaySealed.js";
import { Logger } from "../../../../Contexts/Shared/domain/logging/Logger.js";
import { StructuredLog } from "../../../../Contexts/Shared/domain/logging/StructuredLog.js";
import { config } from "./config.js";
import { currentForecasterVersion, forecastModelName } from "./forecasterVersion.js";

/**
 * 予報のリプレイ CLI（T0-2）: `pnpm replay --snapshot <id> --forecaster <version|current>`
 *
 * 1. Mongo から snapshot と、それを入力にした台帳行を読む → Mongo を閉じる
 * 2. 外部通信を遮断（許可は予報器の LLM エンドポイントだけ・stub なら許可ゼロ）して予報を再実行
 * 3. 再実行の level と台帳の level（同じ forecasterVersion のもの）を突き合わせて JSON で出す
 *
 * 動かせる予報器はこのチェックアウトのものだけ。--forecaster が今の版と違えば実行せず止まる
 * （別の版を動かすには、その版を出したコミットをチェックアウトしてから実行する）。
 * AI_INVESTIGATION_STUB=true なら stub 予報器（決定論・課金なし）。stdout は結果の JSON だけ。
 */

// 予報器（Gemini）に届くためだけの通信先。AI Studio / Vertex AI とその認証（ADC のトークン更新）。
const GEMINI_ENDPOINTS: HostAllowlist = (host) =>
  host === "generativelanguage.googleapis.com" ||
  /^([a-z0-9-]+-)?aiplatform\.googleapis\.com$/.test(host) ||
  host === "oauth2.googleapis.com" ||
  host === "sts.googleapis.com" ||
  host === "metadata.google.internal";

// ログは stderr にだけ出す（stdout の JSON を壊さない）。
class StderrLogger extends Logger {
  async write(log: StructuredLog): Promise<void> {
    console.error(JSON.stringify(log));
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      snapshot: { type: "string" },
      forecaster: { type: "string" },
    },
  });
  const snapshotId = values.snapshot;
  const requestedVersion = values.forecaster;
  if (!snapshotId || !requestedVersion) {
    console.error("usage: pnpm replay --snapshot <snapshotId> --forecaster <forecasterVersion|current>");
    return 2;
  }

  const forecasterVersion = currentForecasterVersion();
  if (requestedVersion !== "current" && requestedVersion !== forecasterVersion) {
    console.error(
      `このチェックアウトの予報器は ${forecasterVersion} です（要求: ${requestedVersion}）。` +
        "その版を出したコミットをチェックアウトし、同じ GEMINI_MODEL / AI_INVESTIGATION_STUB で実行してください。",
    );
    return 2;
  }

  // 1. 読み込みだけ先に済ませて Mongo を閉じる（遮断中に DB へ触れる経路を残さない）。
  const mongo = await new MongoClient(config.mongoUrl).connect();
  let snapshot;
  let recorded: ForecastIssued[];
  try {
    snapshot = await new MongoEvidenceSnapshotRepository(mongo).findById(snapshotId);
    recorded = (await new MongoForecastLedgerRepository(mongo).findAll()).filter(
      (row) => row.evidenceSnapshotId === snapshotId,
    );
  } finally {
    await mongo.close();
  }
  if (!snapshot) {
    console.error(`snapshot が見つかりません: ${snapshotId}`);
    return 1;
  }

  // 2. 遮断下で再実行。
  const stub = config.ai.useStubInvestigation;
  const logger = new StderrLogger();
  const replayed = await replaySealed({
    snapshot,
    forecastPort: new GeminiForecastAdapter(stub ? new StubLLMClient() : new GeminiLLMClient(), logger),
    logger,
    allow: stub ? ALLOW_NONE : GEMINI_ENDPOINTS,
  });

  // 3. 突き合わせ。
  const comparison = compareReplayWithLedger(replayed, recorded, forecasterVersion);
  console.log(
    JSON.stringify(
      {
        snapshotId,
        capturedAt: snapshot.capturedAt.toISOString(),
        forecasterVersion,
        model: forecastModelName(),
        // 非決定性の記録: Gemini 経路は temperature / seed を指定していない（モデル既定）＝
        // 同じ入力・同じ版でも level が揺れうる。stub は固定出力。
        determinism: stub
          ? "deterministic (stub)"
          : "nondeterministic: temperature=unset(model default), seed=unset",
        isFallback: replayed.isFallback,
        verification: replayed.verification,
        ...comparison,
      },
      null,
      2,
    ),
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    process.exit(1);
  },
);
