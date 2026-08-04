/**
 * 引用照合率の集計（E2）。「AI が出した引用のうち、実在に解決した割合」を**引用単位**で数える。
 *
 * 新規の推論はゼロ——保存済み報告書の `citationRefs`（`CitationResolution` が引用と 1:1・件数保存で
 * 添付した照合結果）を数えるだけ。ハルシネーションの間接指標ではなく直接測定で、母数がアラート単位
 * でなく引用単位なので、少ないアラート数でも 1 件が複数の n を生む。
 *
 * 数えるのは **impact.citations と escalation.evidenceBundle だけ**。理由は数え方の正直さ:
 * - `relatedAlerts[].citations` は J1 ゲート（解決しない引用を除去し、ゼロになった関連を破棄）を
 *   通った後なので**定義上 100%**。分子に混ぜると率が自動的に上がる
 * - `remediationReview.citations` は照合結果を持たない＝**測っていない**ので入れない
 * fallback 報告書は impact / escalation を持たないため自然に 0 件寄与になる（除外処理は不要）。
 */

import type {
  CitationRefPrimitives,
  CitationSourceKind,
} from "../../domain/contracts/AlertContract.js";
import { Alert } from "../../domain/Alert.js";

export type CitationKindCount = {
  readonly kind: CitationSourceKind;
  readonly count: number;
};

export type CitationCoverage = {
  // 分母＝AI が出した引用の総数。未照合（解決しなかった引用）も**分母には残す**。
  readonly total: number;
  // 分子＝収集済み証拠カタログの実在物に解決した引用数。
  readonly resolved: number;
  // 解決先の種別内訳（件数降順・同数は種別名順）。未照合の引用は kind を持てないのでここには出ない。
  readonly byKind: readonly CitationKindCount[];
  // 照合結果そのものが未保存の引用数（`citationRefs` を持たない旧データ）。
  // 「解決しなかった」ではなく「測っていない」ので分母にも分子にも入れず、件数だけ残す。
  readonly unmeasured: number;
};

export function buildCitationCoverage(alerts: readonly Alert[]): CitationCoverage {
  let total = 0;
  let resolved = 0;
  let unmeasured = 0;
  const kindCounts = new Map<CitationSourceKind, number>();

  const count = (
    citations: readonly string[] | undefined,
    refs: readonly CitationRefPrimitives[] | undefined,
  ): void => {
    const citationCount = citations?.length ?? 0;
    if (citationCount === 0) return;
    if (refs === undefined) {
      unmeasured += citationCount;
      return;
    }
    total += citationCount;
    for (const ref of refs) {
      if (ref.kind === undefined) continue;
      resolved += 1;
      kindCounts.set(ref.kind, (kindCounts.get(ref.kind) ?? 0) + 1);
    }
  };

  for (const alert of alerts) {
    const report = alert.investigationReport;
    if (report === null) continue;
    count(report.impact?.citations, report.impact?.citationRefs);
    count(report.escalation?.evidenceBundle, report.escalation?.evidenceBundleRefs);
  }

  const byKind = [...kindCounts]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));

  return { total, resolved, byKind, unmeasured };
}
