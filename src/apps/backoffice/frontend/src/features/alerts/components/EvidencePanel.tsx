import { cn } from "@shared/ui/cn";
import type { AlertView } from "../domain/AlertView";
import {
  type EvidenceLogLevel,
  type EvidenceSection,
  evidenceSections,
} from "../domain/EvidenceView";
import type { EvidenceApi } from "../infrastructure/evidenceApi";
import { useEvidence } from "../presentation/hooks/useEvidence";

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
  logs: { label: "Cloud Logging", icon: "▤" },
  terraform: { label: "Terraform", icon: "⬡" },
  commits: { label: "GitHub", icon: "❮❯" },
};

const LOG_LEVEL_CLASS: Record<EvidenceLogLevel, string> = {
  ERROR: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  WARNING: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  INFO: "bg-slate-600/20 text-slate-300 ring-slate-500/30",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
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

function EvidenceSectionView({ section }: { section: EvidenceSection }) {
  if (section.kind === "logs") {
    return (
      <div className="space-y-2">
        <SectionHeader kind="logs" />
        <ul className="space-y-1.5">
          {section.logs.map((log, i) => (
            <li
              key={i}
              className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                    LOG_LEVEL_CLASS[log.severity],
                  )}
                >
                  {log.severity}
                </span>
                <code className="text-[11px] text-slate-400">
                  {log.resource}
                </code>
                <span className="ml-auto text-[11px] text-slate-500">
                  {formatTime(log.timestamp)}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-100">
                {log.message}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (section.kind === "terraform") {
    return (
      <div className="space-y-2">
        <SectionHeader kind="terraform" />
        <div className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60">
          <p className="text-xs text-slate-100">{section.diff.summary}</p>
          {section.diff.changedResources.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {section.diff.changedResources.map((r, i) => (
                <li
                  key={i}
                  className="rounded bg-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-amber-200"
                >
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SectionHeader kind="commits" />
      <ul className="space-y-1.5">
        {section.commits.map((c) => (
          <li
            key={c.sha}
            className="rounded-md bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
          >
            <div className="flex items-center gap-2">
              <code className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[11px] text-cyan-300">
                {c.shortSha}
              </code>
              <span className="text-[11px] text-slate-400">{c.author}</span>
              <span className="ml-auto text-[11px] text-slate-500">
                {formatTime(c.committedAt)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-100">{c.message}</p>
          </li>
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

  const sections = evidence ? evidenceSections(evidence) : [];

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
        <p className="text-xs text-slate-400">証拠は見つかりませんでした。</p>
      ) : (
        <div className="space-y-3">
          {sections.map((section, i) => (
            <div
              key={section.kind}
              className="evidence-rise"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <EvidenceSectionView section={section} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
