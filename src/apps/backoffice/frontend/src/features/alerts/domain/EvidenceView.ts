import type { InfraEvidencePrimitives } from "@monitoring/AIInvestigation/domain/InfraEvidence";
import type { InvestigationStatus } from "@monitoring/AIInvestigation/application/GetInvestigationStatus/InvestigationStatusResponse";

/**
 * インフラ証拠（Cloud Logging / Terraform / GitHub）の表示用型と、
 * ワイヤ契約（backend と共有する InfraEvidencePrimitives）→ View の純関数。
 * domain は型＋純関数のみ。日付は表示側で整形できるよう ISO 文字列のまま持つ。
 */

// 調査ライフサイクルの段階（backend の単一ソースを type-only で再利用）。
// collecting=証拠収集中 / analyzing=AI 調査中 / done=triage 済み（証拠 fetch 可）。
export type { InvestigationStatus };

export type EvidenceLogLevel = "ERROR" | "WARNING" | "INFO";

export type EvidenceLogView = {
  readonly timestamp: string;
  readonly severity: EvidenceLogLevel;
  readonly message: string;
  readonly resource: string;
};

export type EvidenceTerraformView = {
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

export type EvidenceView = {
  readonly appLogs: EvidenceLogView[];
  readonly terraformDiff: EvidenceTerraformView | null;
  readonly recentCommits: EvidenceCommitView[];
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
    collectedAt: dto.collectedAt,
  };
}

/** 証拠ソースの種別。積み上げ演出のアイコン／ラベル出し分けに使う。 */
export type EvidenceSourceKind = "logs" | "terraform" | "commits";

export type EvidenceSection =
  | { readonly kind: "logs"; readonly logs: EvidenceLogView[] }
  | { readonly kind: "terraform"; readonly diff: EvidenceTerraformView }
  | { readonly kind: "commits"; readonly commits: EvidenceCommitView[] };

/**
 * 存在する証拠ソースのみを Cloud Logging→Terraform→GitHub の順で返す純関数。
 * 「到着ごとに積み上がる」演出の単位（＝stagger フェードインする1ブロック）になる。
 * 中身が空のソースは畳んで出さない（空セクションを並べない）。
 */
export function evidenceSections(view: EvidenceView): EvidenceSection[] {
  const sections: EvidenceSection[] = [];
  if (view.appLogs.length > 0) {
    sections.push({ kind: "logs", logs: view.appLogs });
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
