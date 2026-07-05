import type { InvestigationReport } from "../../AlertAnalysis/domain/InvestigationReport.js";
import type {
  ConfidenceCalibrationPrimitives,
  ConfidenceGroundingSignal,
} from "../../AlertAnalysis/domain/contracts/AlertContract.js";
import type { InvestigationContext } from "./InvestigationContext.js";
import { collectCitedEvidenceText } from "./CitedEvidence.js";

/**
 * AI 確信度のキャリブレーション（証拠裏付けによる上限補正）。
 *
 * confidence は LLM の自己申告値で、プロンプトの抑制指示だけでは「証拠が薄いのに高い値」
 * を機械的に防げない。ここで調査コンテキストと報告書から決定的に検証できる裏付けシグナル
 * を数え、シグナルに応じた上限（cap）を超える自己申告を切り詰める。
 *
 * 原則（盛らない制約と同じ思想）:
 * - 下げるだけで絶対に上げない（LLM が自ら低いと言った値は尊重する）
 * - シグナルは LLM の作文でなく、システムが検証できる事実に限る
 *   （relatedAlerts は実在候補との突合、コミット引用は CitedEvidence と同一判定）
 * - 全シグナルが揃っても 0.95 止まり（LLM の推論である以上 100% は主張しない）
 */

// シグナルの語彙はワイヤ契約（contracts）を単一ソースとして共有する。
export type { ConfidenceGroundingSignal };

/** 裏付けゼロ時の上限＝「推測の域」。 */
const BASE_CAP = 0.4;
/** 決定的事実そのもの（既知パターン・引用コミット・Terraform 差分・引用された実在 CVE）。 */
const STRONG_WEIGHT = 0.35;
/** 状況証拠（相関アラート・類似事例・人間の指摘）。 */
const MEDIUM_WEIGHT = 0.15;
/** LLM の推論である以上、ここより上は主張させない。 */
const MAX_CAP = 0.95;

/**
 * 補正結果。signals/cap/original はそのまま報告書へ記録され（ワイヤ契約と同形）、
 * calibrated は報告書の confidence 本体に反映する。
 */
export type ConfidenceCalibration = ConfidenceCalibrationPrimitives & {
  /** min(original, cap)。報告書にはこの値を載せる。 */
  readonly calibrated: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** CVE 識別子の正規形（例: CVE-2021-3807）。スキャナ payload の作り損ないを裏付けに数えない。 */
const CVE_ID_PATTERN = /^CVE-\d{4}-\d{4,}$/i;

/**
 * 検知イベントの payload から CI スキャナ（Trivy 等）由来の CVE id を取り出す。
 * payload は ingest 境界を通ったシステム事実（LLM の作文ではない）だが、形は外部入力なので
 * 正規形に合う id だけを認める（防御的パース）。
 */
function scannerCveIds(payload: Record<string, unknown>): string[] {
  const vulnerabilities = payload["vulnerabilities"];
  if (!Array.isArray(vulnerabilities)) return [];
  return vulnerabilities.flatMap((v) => {
    if (typeof v !== "object" || v === null) return [];
    const cveId = (v as Record<string, unknown>)["cveId"];
    return typeof cveId === "string" && CVE_ID_PATTERN.test(cveId) ? [cveId] : [];
  });
}

function detectSignals(
  report: InvestigationReport,
  context: InvestigationContext,
): ConfidenceGroundingSignal[] {
  const signals: ConfidenceGroundingSignal[] = [];

  if (context.knownPatterns.length > 0) signals.push("known_pattern");

  const citedText = collectCitedEvidenceText(report).toLowerCase();

  const commits = context.infraEvidence?.recentCommits ?? [];
  if (commits.length > 0) {
    if (commits.some((c) => citedText.includes(c.sha.toLowerCase()))) {
      signals.push("cited_commit");
    }
  }

  if ((context.infraEvidence?.terraformDiff?.resourceChanges.length ?? 0) > 0) {
    signals.push("terraform_diff");
  }

  // CI スキャナが検出した実在 CVE を報告書が実際に引用していれば強い裏付け（cited_commit と同型:
  // 「システム事実の存在」×「報告書がそれを根拠にした」の両方を要求する）。
  const cveIds = scannerCveIds(context.errorEvent.payload);
  if (cveIds.some((id) => citedText.includes(id.toLowerCase()))) {
    signals.push("verifiable_cve");
  }

  const candidateIds = new Set(
    (context.candidateAlerts ?? []).map((c) => c.alertId),
  );
  // 実在候補との突合に加えて citations（共有証拠の引用）を必須にする（タスク J1）。
  // マッパのガードを通った関連は解決済み citation を必ず持つので、正当な相関の加点は温存され、
  // 根拠なき相関（捏造の因果橋・旧データの citation 無し）だけが加点から外れる。
  if (
    report.relatedAlerts.some(
      (r) => candidateIds.has(r.alertId) && (r.citations?.length ?? 0) > 0,
    )
  ) {
    signals.push("related_alert");
  }

  if (context.similarIncidents.length > 0) signals.push("similar_incident");

  if (context.operatorNote && context.operatorNote.trim() !== "") {
    signals.push("operator_note");
  }

  return signals;
}

const STRONG_SIGNALS: ReadonlySet<ConfidenceGroundingSignal> = new Set([
  "known_pattern",
  "cited_commit",
  "terraform_diff",
  "verifiable_cve",
]);

export function calibrateConfidence(
  report: InvestigationReport,
  context: InvestigationContext,
): ConfidenceCalibration {
  // fallback は confidence=0 の定型で、自己申告ですらないため補正対象外。
  if (report.isFallback) {
    return {
      signals: [],
      cap: 0,
      original: report.confidence,
      calibrated: report.confidence,
    };
  }

  const signals = detectSignals(report, context);
  const cap = round2(
    Math.min(
      MAX_CAP,
      BASE_CAP +
        signals.reduce(
          (sum, s) =>
            sum + (STRONG_SIGNALS.has(s) ? STRONG_WEIGHT : MEDIUM_WEIGHT),
          0,
        ),
    ),
  );

  return {
    signals,
    cap,
    original: report.confidence,
    calibrated: Math.min(report.confidence, cap),
  };
}
