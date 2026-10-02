import { ForecastIssued } from "./ForecastLedger.js";
import { RiskForecast } from "./RiskForecast.js";

/**
 * リプレイ結果と台帳の突き合わせ（T0-2）。比べるのは subject ごとの level だけ
 * （reasoning・confidence は LLM の揺れで毎回変わるので、判定の同一性の単位にしない）。
 * 同じ subject の risk が複数あっても落とさないよう、"subject=level" の並べ替え済み列で比べる。
 */
export type ReplayComparison = {
  readonly replayed: string[];
  readonly recorded: {
    readonly briefingId: string;
    readonly forecasterVersion: string;
    readonly levels: string[];
  }[];
  // 同じ forecasterVersion の記録が1件も無ければ null（比べる相手がいない）。
  readonly sameVersionLevelsMatch: boolean | null;
};

export function compareReplayWithLedger(
  replayed: RiskForecast,
  recordedRows: readonly ForecastIssued[],
  forecasterVersion: string,
): ReplayComparison {
  const replayedLevels = sortedLevels(replayed.risks);
  const byBriefing = new Map<string, ForecastIssued[]>();
  for (const row of recordedRows) {
    byBriefing.set(row.briefingId, [...(byBriefing.get(row.briefingId) ?? []), row]);
  }
  const recorded = [...byBriefing.entries()].map(([briefingId, rows]) => ({
    briefingId,
    forecasterVersion: rows[0].forecasterVersion,
    levels: sortedLevels(rows.map((row) => ({ subject: row.subjectKey, level: row.level }))),
  }));
  const sameVersion = recorded.filter((r) => r.forecasterVersion === forecasterVersion);
  return {
    replayed: replayedLevels,
    recorded,
    sameVersionLevelsMatch:
      sameVersion.length === 0
        ? null
        : sameVersion.every((r) => r.levels.join("\n") === replayedLevels.join("\n")),
  };
}

function sortedLevels(risks: readonly { subject: string; level: string }[]): string[] {
  return risks.map((risk) => `${risk.subject}=${risk.level}`).sort();
}
