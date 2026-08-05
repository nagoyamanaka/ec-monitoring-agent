/**
 * E7: PR コメントへ予報を届ける CI エントリ（`.github/workflows/forecast-pr-comment.yml` から起動）。
 *
 * 本番 edge の `GET /forecast` を引き、この PR の subject に該当する予報があれば
 * コメント本文を1ファイル書き出す。**投稿そのものは workflow（gh）が行う**——ここは
 * 「取得 → 判断 → 本文」までで、GitHub への書き込み権は持たない。
 *
 * ## このスクリプトは絶対に非ゼロで終わらない
 *
 * 予報は**参照であって gate ではない**（DORA の CAB 所見に正面から反するため、止める実装は
 * 入れない）。edge が落ちていても・予報が未生成でも・JSON が壊れていても、warning を出して
 * exit 0 で終わる。「予報が出せないこと」でリリースを止めるのは、gate を作るのと同じ害がある。
 *
 * ## 出さなかったときも必ずジョブサマリに残す
 *
 * CI から `GET /forecast` を参照できること自体が E7 の従の要件で、その痕跡がここ。
 * 「該当が無かった」と「edge に繋がらなかった」を同じ沈黙に畳まない。
 */

import { appendFile, writeFile } from "node:fs/promises";
import {
  buildPullRequestForecastComment,
  pullRequestSubject,
  type ForecastCommentDecision,
  type PullRequestContext,
} from "../../../Contexts/Monitoring/Forecast/domain/pullRequestForecastComment.js";
import type { ForecastBriefingPrimitives } from "../../../Contexts/Monitoring/Forecast/domain/contracts/ForecastContract.js";

const FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_BODY_FILE = "forecast-pr-comment.md";

async function main(): Promise<void> {
  const bodyFile = process.env.COMMENT_BODY_FILE ?? DEFAULT_BODY_FILE;

  const edgeUrl = process.env.FORECAST_EDGE_URL?.trim();
  if (!edgeUrl) {
    await report({ summary: "FORECAST_EDGE_URL が未設定のため、予報を参照していません。" });
    return;
  }

  const pr = readPullRequestContext();
  if (!pr) {
    await report({ summary: "PR の情報（番号・タイトル・ブランチ名）が揃っていません。" });
    return;
  }

  const briefing = await fetchBriefing(edgeUrl);
  if (typeof briefing === "string") {
    await report({ summary: briefing });
    return;
  }

  const decision = buildPullRequestForecastComment(briefing, pr);
  await report({
    summary: summarize(briefing, pr, decision),
    ...(decision.kind === "comment"
      ? { body: { file: bodyFile, text: decision.body } }
      : {}),
  });
}

function readPullRequestContext(): PullRequestContext | undefined {
  const number = Number(process.env.PR_NUMBER);
  const title = process.env.PR_TITLE ?? "";
  const headRef = process.env.PR_HEAD_REF ?? "";
  if (!Number.isInteger(number) || number <= 0) return undefined;

  // 予測発生時刻の**人手の注記**（E6-2）。`window` は LLM 由来の自由文字列なので、
  // 構造化を先回りせず注記で受ける。読めない値は「無かった」と同じに扱う（推定しない）。
  const predictedAt = parseDate(process.env.FORECAST_PREDICTED_AT);
  return { number, title, headRef, ...(predictedAt ? { predictedAt } : {}) };
}

function parseDate(raw: string | undefined): Date | undefined {
  if (!raw || raw.trim() === "") return undefined;
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) {
    warn(`FORECAST_PREDICTED_AT を日時として読めませんでした（${raw}）。注記なしとして続行します。`);
    return undefined;
  }
  return parsed;
}

/** 取得できれば briefing、できなければ**理由の文字列**（失敗を例外にしない）。 */
async function fetchBriefing(
  edgeUrl: string,
): Promise<ForecastBriefingPrimitives | string> {
  const url = `${edgeUrl.replace(/\/+$/, "")}/forecast`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status === 404) {
      return "予報がまだ生成されていません（GET /forecast → 404）。";
    }
    if (!response.ok) {
      return `GET /forecast が ${response.status} を返しました。予報は参照できていません。`;
    }
    return (await response.json()) as ForecastBriefingPrimitives;
  } catch (error) {
    return `GET /forecast に到達できませんでした（${(error as Error).message}）。`;
  }
}

function summarize(
  briefing: ForecastBriefingPrimitives,
  pr: PullRequestContext,
  decision: ForecastCommentDecision,
): string {
  const { forecast } = briefing;
  const head = [
    `予報 \`${forecast.forecastId}\`（生成 ${forecast.generatedAt} / 対象期間 ${forecast.horizon}）`,
    `リスク ${forecast.risks.length} 件・シグナル ${briefing.signals.length} 件`,
    `PR #${pr.number} の突合キー: \`${pullRequestSubject(pr)}\``,
  ].join(" / ");

  if (decision.kind !== "comment") {
    return `${head}\n\n**コメントは出していません**: ${decision.reason}`;
  }
  const basis =
    decision.matchedBy === "citation"
      ? "この PR が予報の根拠に引用されている"
      : "subject のトークン一致";
  return `${head}\n\n**コメントを出しました**（${decision.level}・subject \`${decision.subject}\`・該当の根拠: ${basis}）。`;
}

/** ジョブサマリは常に書く。本文ファイルと `matched` 出力は該当があったときだけ。 */
async function report(params: {
  summary: string;
  body?: { file: string; text: string };
}): Promise<void> {
  console.log(params.summary);
  await appendIfSet("GITHUB_STEP_SUMMARY", `${params.summary}\n`);
  if (!params.body) {
    await appendIfSet("GITHUB_OUTPUT", "matched=false\n");
    return;
  }
  await writeFile(params.body.file, params.body.text, "utf8");
  await appendIfSet("GITHUB_OUTPUT", `matched=true\nbody-file=${params.body.file}\n`);
}

async function appendIfSet(envName: string, text: string): Promise<void> {
  const path = process.env[envName];
  if (!path) return;
  await appendFile(path, text, "utf8");
}

function warn(message: string): void {
  console.log(`::warning::${message}`);
}

// 何が起きても job は緑のまま終わる（参照であって gate ではない）。
main().catch((error: unknown) => {
  warn(`予報の参照に失敗しました（${(error as Error).message}）。PR はブロックしません。`);
  process.exitCode = 0;
});
