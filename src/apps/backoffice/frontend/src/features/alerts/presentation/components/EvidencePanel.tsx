import type { ReactNode } from "react";
import { cn } from "@shared/ui/cn";
import { formatDateTimeJa } from "@shared/format/dateTime";
import type { AlertView } from "../../domain/AlertView";
import {
  type EvidenceLogLevel,
  type EvidenceSection,
  type EvidenceTerraformAction,
  evidenceSections,
} from "../../domain/EvidenceView";
import type { EvidenceApi } from "../../infrastructure/evidenceApi";
import { useEvidence } from "../hooks/useEvidence";

export interface EvidencePanelProps {
  api: EvidenceApi;
  /** SSE ライブの alert。status から証拠の取得タイミング（done）を導出する。 */
  alert: AlertView;
  className?: string;
}

const SOURCE_META: Record<
  EvidenceSection["kind"],
  { label: string; icon: string }
> = {
  security: { label: "Trivy (CI スキャン)", icon: "🛡" },
  logs: { label: "Cloud Logging", icon: "▤" },
  metrics: { label: "Cloud Monitoring", icon: "📈" },
  terraform: { label: "Terraform", icon: "⬡" },
  commits: { label: "GitHub", icon: "❮❯" },
};

/** メトリクス値の表示整形。ratio は %、null は "—"。 */
function formatMetric(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  if (unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(2));
  return unit && unit !== "ratio" ? `${rounded} ${unit}` : `${rounded}`;
}

const LOG_LEVEL_CLASS: Record<EvidenceLogLevel, string> = {
  ERROR: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  WARNING: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  INFO: "bg-slate-600/20 text-slate-300 ring-slate-500/30",
};

const TF_ACTION_CLASS: Record<EvidenceTerraformAction, string> = {
  create: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  update: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  replace: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  delete: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

/** stagger 1 ステップの遅延（秒）。証拠を 1 行ずつ積み上げる体感を作る。 */
const RISE_STEP = 0.09;

/** 証拠が「1 行ずつ到着する」演出ラッパ。index 順に遅延を載せてフェードインする。 */
function Rise({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("evidence-rise", className)}
      style={{ animationDelay: `${index * RISE_STEP}s` }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ kind }: { kind: EvidenceSection["kind"] }) {
  const meta = SOURCE_META[kind];
  return (
    <h5 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
      <span aria-hidden className="text-cyan-300">
        {meta.icon}
      </span>
      {meta.label}
    </h5>
  );
}

/** 1 セクションが占める stagger スロット数（ヘッダ 1 ＋ 行数）。次セクションの基点計算に使う。 */
function sectionSlotCount(section: EvidenceSection): number {
  if (section.kind === "security") return 1 + section.findings.length;
  if (section.kind === "logs") return 1 + section.logs.length;
  if (section.kind === "metrics") return 1 + section.metrics.length;
  // summary 行 ＋ 変更リソース 1 行/件（無ければ chips の 1 行）。
  if (section.kind === "terraform")
    return 1 + 1 + Math.max(section.diff.resourceChanges.length, 1);
  return 1 + section.commits.length;
}

/**
 * 1 ソースの証拠ブロック。ヘッダ・各行を baseIndex からの連番で stagger フェードインさせ、
 * パネル全体で「証拠が 1 行ずつ積み上がる」連続演出にする（タスク12・本命）。
 */
/** CVE 深刻度バッジの色。スキャナ語彙（CRITICAL/HIGH/…）に無い値は控えめ表示に落とす。 */
const CVE_SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  HIGH: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
};

function EvidenceSectionView({
  section,
  baseIndex,
}: {
  section: EvidenceSection;
  baseIndex: number;
}) {
  if (section.kind === "security") {
    return (
      <div className="space-y-2">
        <Rise index={baseIndex}>
          <SectionHeader kind="security" />
        </Rise>
        <ul className="space-y-1.5">
          {section.findings.map((f, i) => (
            <Rise
              key={f.cveId}
              index={baseIndex + 1 + i}
              className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                    CVE_SEVERITY_CLASS[f.severity] ??
                      "bg-slate-600/20 text-slate-300 ring-slate-500/30",
                  )}
                >
                  {f.severity}
                </span>
                {/* CVE は公的 DB（NVD）に実在する識別子＝合成デモでも本物のリンク先を持つ証拠。 */}
                <a
                  href={f.nvdUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="NVD で脆弱性詳細を開く"
                  className="rounded bg-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300 underline decoration-dotted underline-offset-2 transition hover:bg-slate-600/60 hover:text-cyan-200"
                >
                  {f.cveId}
                </a>
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-slate-300">
                {f.package}:{" "}
                <span className="text-rose-300">{f.version}</span>
                {f.fixedVersion && (
                  <>
                    <span className="text-slate-400"> → </span>
                    <span className="text-emerald-300">{f.fixedVersion}</span>
                  </>
                )}
              </p>
            </Rise>
          ))}
        </ul>
      </div>
    );
  }

  if (section.kind === "logs") {
    return (
      <div className="space-y-2">
        <Rise index={baseIndex}>
          <SectionHeader kind="logs" />
        </Rise>
        <ul className="space-y-1.5">
          {section.logs.map((log, i) => (
            <Rise
              key={i}
              index={baseIndex + 1 + i}
              className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                    LOG_LEVEL_CLASS[log.severity],
                  )}
                >
                  {log.severity}
                </span>
                <code className="text-[11px] text-slate-300">
                  {log.resource}
                </code>
                <span className="ml-auto text-[11px] text-slate-400">
                  {formatDateTimeJa(log.timestamp)}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-100">
                {log.message}
              </p>
            </Rise>
          ))}
        </ul>
      </div>
    );
  }

  if (section.kind === "metrics") {
    return (
      <div className="space-y-2">
        <Rise index={baseIndex}>
          <SectionHeader kind="metrics" />
        </Rise>
        <ul className="space-y-1.5">
          {section.metrics.map((m, i) => (
            <Rise
              key={m.metricType}
              index={baseIndex + 1 + i}
              className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-100">
                  {m.displayName}
                </span>
                <code className="text-[11px] text-slate-400">{m.metricType}</code>
              </div>
              <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-300">
                <span>
                  latest{" "}
                  <span className="font-mono text-cyan-300">
                    {formatMetric(m.latest, m.unit)}
                  </span>
                </span>
                <span>
                  max{" "}
                  <span className="font-mono text-amber-200">
                    {formatMetric(m.max, m.unit)}
                  </span>
                </span>
                <span className="ml-auto text-slate-400">{m.points} pts</span>
              </div>
            </Rise>
          ))}
        </ul>
      </div>
    );
  }

  if (section.kind === "terraform") {
    const { diff } = section;
    return (
      <div className="space-y-2">
        <Rise index={baseIndex}>
          <SectionHeader kind="terraform" />
        </Rise>
        <Rise
          index={baseIndex + 1}
          className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
        >
          <p className="text-xs text-slate-100">{diff.summary}</p>
          <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <span>
              適用 {formatDateTimeJa(diff.appliedAt)}
              {diff.commitSha ? ` · ${diff.commitSha.slice(0, 7)}` : ""}
            </span>
            {/* 由来変更の原典（実在 PR）。コミット証拠の sha リンクと同じクリック語彙で出す。 */}
            {diff.url && (
              <a
                href={diff.url}
                target="_blank"
                rel="noreferrer"
                title="GitHub で由来変更の PR を開く"
                className="ml-auto rounded bg-slate-700/40 px-1.5 py-0.5 text-[11px] text-cyan-300 underline decoration-dotted underline-offset-2 transition hover:bg-slate-600/60 hover:text-cyan-200"
              >
                変更 PR を開く →
              </a>
            )}
          </p>
        </Rise>
        {diff.resourceChanges.length > 0
          ? diff.resourceChanges.map((change, i) => (
              <Rise
                key={change.address}
                index={baseIndex + 2 + i}
                className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ring-1 ring-inset",
                      TF_ACTION_CLASS[change.action],
                    )}
                  >
                    {change.action}
                  </span>
                  <code className="font-mono text-[11px] text-amber-200">
                    {change.address}
                  </code>
                </div>
                {change.attributeDeltas.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {change.attributeDeltas.map((d, j) => (
                      <li key={j} className="font-mono text-[11px] text-slate-300">
                        <span className="text-slate-300">{d.key}:</span>{" "}
                        <span className="text-rose-300">{d.before ?? "—"}</span>
                        <span className="text-slate-400"> → </span>
                        <span className="text-emerald-300">{d.after ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Rise>
            ))
          : diff.changedResources.length > 0 && (
              <Rise
                index={baseIndex + 2}
                className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
              >
                <ul className="flex flex-wrap gap-1.5">
                  {diff.changedResources.map((r, i) => (
                    <li
                      key={i}
                      className="rounded bg-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-amber-200"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </Rise>
            )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Rise index={baseIndex}>
        <SectionHeader kind="commits" />
      </Rise>
      <ul className="space-y-1.5">
        {section.commits.map((c, i) => (
          <Rise
            key={c.sha}
            index={baseIndex + 1 + i}
            className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
          >
            <div className="flex items-center gap-2">
              {c.url ? (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  title="GitHub でコミットを開く"
                  className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[11px] text-cyan-300 underline decoration-dotted underline-offset-2 transition hover:bg-slate-600/60 hover:text-cyan-200"
                >
                  {c.shortSha}
                </a>
              ) : (
                <code className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[11px] text-cyan-300">
                  {c.shortSha}
                </code>
              )}
              <span className="text-[11px] text-slate-300">{c.author}</span>
              <span className="ml-auto text-[11px] text-slate-400">
                {formatDateTimeJa(c.committedAt)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-100">{c.message}</p>
          </Rise>
        ))}
      </ul>
    </div>
  );
}

/**
 * インフラ証拠（Cloud Logging / Terraform / GitHub）の積み上げ可視化＝自律性の見せ場（タスク8）。
 * 調査完了（done）は SSE ライブの alert.status から導出し（useEvidence）、done になった瞬間に証拠を fetch。
 * 各ソースのセクションを 1 つずつ stagger フェードイン（`evidence-rise`・reduced-motion 尊重）させ、
 * 「AI が調べている過程」を演出する。
 */
export function EvidencePanel({ api, alert, className }: EvidencePanelProps) {
  const { phase, evidence, error } = useEvidence(api, alert);

  // SECURITY 検知の CVE（検知イベント payload 由来）は調査収集の証拠と並べて1枚のパネルにする。
  const sections = evidence
    ? evidenceSections(evidence, alert.securityFindings)
    : [];

  return (
    <section className={cn("space-y-3", className)} aria-label="収集した証拠">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        収集した証拠
      </h4>

      {phase === "error" ? (
        <div className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-inset ring-rose-500/30">
          証拠の取得に失敗しました。{error?.message}
        </div>
      ) : phase === "analyzing" ? (
        <div className="flex items-center gap-2 rounded-md bg-slate-800/40 px-3 py-3 text-xs text-slate-300 ring-1 ring-inset ring-slate-700/60">
          <span
            aria-hidden
            className="h-2 w-2 animate-pulse rounded-full bg-cyan-400"
          />
          AI が証拠を解析しています…
        </div>
      ) : sections.length === 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-300">
            原因の根拠として引用されたインフラ証拠（ログ・メトリクス・Terraform・コミット）はありませんでした。
          </p>
          <p className="text-[11px] text-slate-400">
            根拠が関連アラートや過去の同型事例にある場合は、それぞれのセクションに表示されます。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, i) => {
            // 前セクションまでの累積スロット数を基点に、行単位で連続 stagger させる。
            const baseIndex = sections
              .slice(0, i)
              .reduce((sum, s) => sum + sectionSlotCount(s), 0);
            return (
              <EvidenceSectionView
                key={section.kind}
                section={section}
                baseIndex={baseIndex}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
