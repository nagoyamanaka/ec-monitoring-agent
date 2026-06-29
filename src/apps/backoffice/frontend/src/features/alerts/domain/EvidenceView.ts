import type { InfraEvidencePrimitives } from "@monitoring/AIInvestigation/domain/InfraEvidence";

/**
 * インフラ証拠（Cloud Logging / Terraform / GitHub）の表示用型と、
 * ワイヤ契約（backend と共有する InfraEvidencePrimitives）→ View の純関数。
 * domain は型＋純関数のみ。日付は表示側で整形できるよう ISO 文字列のまま持つ。
 *
 * 調査の完了判定（done）は SSE で更新される alert.status から導出する（useEvidence）。
 * そのため status 用の専用型はここに持たない（同じ事実を二重に持たない・段階1の設計統一）。
 */

export type EvidenceLogLevel = "ERROR" | "WARNING" | "INFO";

export type EvidenceLogView = {
  readonly timestamp: string;
  readonly severity: EvidenceLogLevel;
  readonly message: string;
  readonly resource: string;
};

export type EvidenceTerraformAction = "create" | "update" | "delete" | "replace";

export type EvidenceTerraformDeltaView = {
  readonly key: string;
  readonly before: string | null;
  readonly after: string | null;
};

export type EvidenceTerraformChangeView = {
  readonly address: string;
  readonly action: EvidenceTerraformAction;
  readonly attributeDeltas: EvidenceTerraformDeltaView[];
};

export type EvidenceTerraformView = {
  readonly resourceChanges: EvidenceTerraformChangeView[];
  /** 適用時刻（ISO 文字列・表示側で整形）。 */
  readonly appliedAt: string;
  readonly commitSha: string | null;
  readonly changedResources: string[];
  readonly summary: string;
};

export type EvidenceCommitView = {
  readonly sha: string;
  /** 表示用の短縮 SHA（先頭7桁）。 */
  readonly shortSha: string;
  readonly message: string;
  readonly author: string;
  readonly committedAt: string;
};

export type EvidenceMetricView = {
  readonly metricType: string;
  readonly displayName: string;
  readonly unit: string | null;
  readonly latest: number | null;
  readonly max: number | null;
  readonly points: number;
};

export type EvidenceView = {
  readonly appLogs: EvidenceLogView[];
  readonly terraformDiff: EvidenceTerraformView | null;
  readonly recentCommits: EvidenceCommitView[];
  readonly metrics: EvidenceMetricView[];
  readonly collectedAt: string;
};

export function toEvidenceView(dto: InfraEvidencePrimitives): EvidenceView {
  return {
    appLogs: dto.appLogs.map((log) => ({
      timestamp: log.timestamp,
      severity: log.severity as EvidenceLogLevel,
      message: log.message,
      resource: log.resource,
    })),
    terraformDiff: dto.terraformDiff
      ? {
          resourceChanges: dto.terraformDiff.resourceChanges.map((c) => ({
            address: c.address,
            action: c.action,
            attributeDeltas: c.attributeDeltas.map((d) => ({
              key: d.key,
              before: d.before,
              after: d.after,
            })),
          })),
          appliedAt: dto.terraformDiff.appliedAt,
          commitSha: dto.terraformDiff.commitSha ?? null,
          changedResources: dto.terraformDiff.changedResources,
          summary: dto.terraformDiff.summary,
        }
      : null,
    recentCommits: (dto.recentCommits ?? []).map((c) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.message,
      author: c.author,
      committedAt: c.committedAt,
    })),
    metrics: (dto.metrics ?? []).map((m) => ({
      metricType: m.metricType,
      displayName: m.displayName,
      unit: m.unit ?? null,
      latest: m.latest,
      max: m.max,
      points: m.points,
    })),
    collectedAt: dto.collectedAt,
  };
}

/** 証拠ソースの種別。積み上げ演出のアイコン／ラベル出し分けに使う。 */
export type EvidenceSourceKind = "logs" | "metrics" | "terraform" | "commits";

export type EvidenceSection =
  | { readonly kind: "logs"; readonly logs: EvidenceLogView[] }
  | { readonly kind: "metrics"; readonly metrics: EvidenceMetricView[] }
  | { readonly kind: "terraform"; readonly diff: EvidenceTerraformView }
  | { readonly kind: "commits"; readonly commits: EvidenceCommitView[] };

/**
 * 存在する証拠ソースのみを Cloud Logging→Cloud Monitoring→Terraform→GitHub の順で返す純関数。
 * 「到着ごとに積み上がる」演出の単位（＝stagger フェードインする1ブロック）になる。
 * 中身が空のソースは畳んで出さない（空セクションを並べない）。
 */
export function evidenceSections(view: EvidenceView): EvidenceSection[] {
  const sections: EvidenceSection[] = [];
  if (view.appLogs.length > 0) {
    sections.push({ kind: "logs", logs: view.appLogs });
  }
  if (view.metrics.length > 0) {
    sections.push({ kind: "metrics", metrics: view.metrics });
  }
  if (view.terraformDiff && view.terraformDiff.changedResources.length > 0) {
    sections.push({ kind: "terraform", diff: view.terraformDiff });
  }
  if (view.recentCommits.length > 0) {
    sections.push({ kind: "commits", commits: view.recentCommits });
  }
  return sections;
}

/** 証拠が1件も無いか（空表示の出し分けに使う）。 */
export function isEvidenceEmpty(view: EvidenceView): boolean {
  return evidenceSections(view).length === 0;
}
