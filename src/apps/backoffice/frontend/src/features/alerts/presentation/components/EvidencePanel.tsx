import { useRef, useState, type ReactNode } from "react";
import { cn } from "@shared/ui/cn";
import type { IconComponent } from "@shared/ui/icons";
import { formatDateTimeJa } from "@shared/format/dateTime";
import type { AlertView } from "../../domain/AlertView";
import {
  type EvidenceLogLevel,
  type EvidenceSection,
  type EvidenceTerraformAction,
  evidenceSections,
} from "../../domain/EvidenceView";
import type { EvidenceApi } from "../../infrastructure/evidenceApi";
import {
  evidenceLedgerKeys,
  type EvidenceLedgerKey,
} from "../../domain/evidenceLedger";
import { collectPastIncidentRefs } from "../../domain/relatedAlerts";
import { useEvidence } from "../hooks/useEvidence";
import { EvidenceCountsGrid } from "./EvidenceCountsGrid";
import { EVIDENCE_SOURCE_ICONS } from "./evidenceSourceIcons";

export interface EvidencePanelProps {
  api: EvidenceApi;
  /** SSE ライブの alert。status から証拠の取得タイミング（done）を導出する。 */
  alert: AlertView;
  /**
   * 一覧のアラート集合。台帳の「過去事例」セルが実際に「過去の同型事例」節へ
   * 出たか（＝引用されたか）を collectPastIncidentRefs で突合するのに使う。
   * 未指定なら back-link/AI 相関のみで判定する。
   */
  corpus?: readonly AlertView[];
  className?: string;
}

const SOURCE_META: Record<
  EvidenceSection["kind"],
  { label: string; icon: IconComponent }
> = {
  security: { label: "Trivy (CI スキャン)", icon: EVIDENCE_SOURCE_ICONS.security },
  logs: { label: "Cloud Logging", icon: EVIDENCE_SOURCE_ICONS.logs },
  metrics: { label: "Cloud Monitoring", icon: EVIDENCE_SOURCE_ICONS.metrics },
  terraform: { label: "Terraform", icon: EVIDENCE_SOURCE_ICONS.terraformChanges },
  commits: { label: "GitHub", icon: EVIDENCE_SOURCE_ICONS.commits },
};

/** メトリクス値の表示整形。ratio は %、null は "—"。 */
function formatMetric(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  if (unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(2));
  return unit && unit !== "ratio" ? `${rounded} ${unit}` : `${rounded}`;
}

const LOG_LEVEL_CLASS: Record<EvidenceLogLevel, string> = {
  ERROR: "bg-rose-500/15 text-rose-300",
  WARNING: "bg-amber-500/15 text-amber-200",
  INFO: "bg-slate-600/20 text-slate-300",
};

const TF_ACTION_CLASS: Record<EvidenceTerraformAction, string> = {
  create: "bg-emerald-500/15 text-emerald-300",
  update: "bg-amber-500/15 text-amber-200",
  replace: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  delete: "bg-rose-500/15 text-rose-300",
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
  const SourceIcon = meta.icon;
  return (
    <h5 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-300">
      <SourceIcon className="shrink-0 text-slate-400" />
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
  CRITICAL: "bg-rose-500/15 text-rose-300",
  HIGH: "bg-amber-500/15 text-amber-200",
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
              className="rounded-md bg-slate-800/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                    CVE_SEVERITY_CLASS[f.severity] ??
                      "bg-slate-600/20 text-slate-300",
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
                  className="rounded-md bg-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300 underline decoration-dotted underline-offset-2 transition hover:bg-slate-600/60 hover:text-cyan-200"
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
              className="rounded-md bg-slate-800/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
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
              className="rounded-md bg-slate-800/40 px-3 py-2"
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
                  <span className="font-mono text-slate-100">
                    {formatMetric(m.latest, m.unit)}
                  </span>
                </span>
                <span>
                  max{" "}
                  <span className="font-mono text-slate-100">
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
          className="rounded-md bg-slate-800/40 px-3 py-2"
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
                className="ml-auto rounded-md bg-slate-700/40 px-1.5 py-0.5 text-[11px] text-cyan-300 underline decoration-dotted underline-offset-2 transition hover:bg-slate-600/60 hover:text-cyan-200"
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
                className="rounded-md bg-slate-800/40 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-medium uppercase",
                      TF_ACTION_CLASS[change.action],
                    )}
                  >
                    {change.action}
                  </span>
                  <code className="font-mono text-[11px] text-slate-300">
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
                className="rounded-md bg-slate-800/40 px-3 py-2"
              >
                <ul className="flex flex-wrap gap-1.5">
                  {diff.changedResources.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-md bg-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-300"
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

  return <CommitsSectionView section={section} baseIndex={baseIndex} />;
}

/** 折りたたみ前に見せる直近コミット数。 */
const COMMITS_PREVIEW = 3;

/**
 * コミット証拠のセクション。直近コミットは「原因の周辺文脈」で1件ずつの証拠力は弱いため、
 * 既定は先頭 3 件に畳み「残り N 件を表示」で展開する（実在性は展開で担保・壁のように積まない）。
 */
function CommitsSectionView({
  section,
  baseIndex,
}: {
  section: Extract<EvidenceSection, { kind: "commits" }>;
  baseIndex: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const hiddenCount = section.commits.length - COMMITS_PREVIEW;
  const visible = showAll
    ? section.commits
    : section.commits.slice(0, COMMITS_PREVIEW);
  return (
    <div className="space-y-2">
      <Rise index={baseIndex}>
        <SectionHeader kind="commits" />
      </Rise>
      <ul className="space-y-1.5">
        {visible.map((c, i) => (
          <Rise
            key={c.sha}
            index={baseIndex + 1 + i}
            className="rounded-md bg-slate-800/40 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {c.url ? (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  title="GitHub でコミットを開く"
                  className="rounded-md bg-slate-700/40 px-1.5 py-0.5 text-[11px] text-cyan-300 underline decoration-dotted underline-offset-2 transition hover:bg-slate-600/60 hover:text-cyan-200"
                >
                  {c.shortSha}
                </a>
              ) : (
                <code className="rounded-md bg-slate-700/40 px-1.5 py-0.5 text-[11px] text-slate-300">
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
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-md bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700/50 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          残り {hiddenCount} 件のコミットを表示
        </button>
      )}
    </div>
  );
}

/**
 * インフラ証拠（Cloud Logging / Terraform / GitHub）の積み上げ可視化＝自律性の見せ場（タスク8）。
 * 調査完了（done）は SSE ライブの alert.status から導出し（useEvidence）、done になった瞬間に証拠を fetch。
 * 各ソースのセクションを 1 つずつ stagger フェードイン（`evidence-rise`・reduced-motion 尊重）させ、
 * 「AI が調べている過程」を演出する。
 */
/** 件数グリッドのキー → 本パネル内セクション kind（過去事例は本パネル外＝対応なし）。 */
const COUNT_KEY_TO_KIND: Partial<
  Record<EvidenceLedgerKey, EvidenceSection["kind"]>
> = {
  security: "security",
  logs: "logs",
  metrics: "metrics",
  terraformChanges: "terraform",
  commits: "commits",
};

export function EvidencePanel({
  api,
  alert,
  corpus,
  className,
}: EvidencePanelProps) {
  const { phase, evidence, error } = useEvidence(api, alert);

  // SECURITY 検知の CVE（検知イベント payload 由来）は調査収集の証拠と並べて1枚のパネルにする。
  const sections = evidence
    ? evidenceSections(evidence, alert.securityFindings)
    : [];

  // 証拠件数の実測（backend 記録）。あれば台帳グリッドを先頭に出す（C-3）。
  // 「探した結果ゼロ」も情報なので 0 のカテゴリを隠さない。旧 Alert・fallback は未記録＝出さない。
  const counts = alert.report?.metrics?.evidenceCounts;

  // 台帳セルは category オーナーシップで調査した証拠源に絞る（0=調べたが無し、を嘘にしない）。
  // Trivy（CI スキャン）は調査収集でなく検知 payload 由来＝件数がある時だけセルが立つ。
  const securityCount = alert.securityFindings.length;
  const ledgerKeys = counts
    ? evidenceLedgerKeys(alert.category, counts, securityCount)
    : [];

  // グリッド＝件数の台帳、直下のセクション＝実物。>0 セルのクリックで該当セクションへ
  // スクロールし、台帳と実物の対応を指で確認できるようにする（ドロワーでも迷わない）。
  const sectionRefs = useRef<
    Partial<Record<EvidenceSection["kind"], HTMLDivElement | null>>
  >({});
  const navigable = new Set(
    (Object.keys(COUNT_KEY_TO_KIND) as EvidenceLedgerKey[]).filter((key) =>
      sections.some((s) => s.kind === COUNT_KEY_TO_KIND[key]),
    ),
  );

  // 収集したが原因へ引用されず、実物セクションが出ない証拠源（現状は CitedCommitFilter で
  // 引用 sha だけに絞られるコミットが該当）。台帳の数字は「調査の広さ」の実測として残しつつ、
  // 「結論の裏付け」ではないことをグレー格下げ+但し書きで明示する（隠蔽でなく引用規律）。
  // 過去事例の実物は本パネル外（「過去の同型事例」節）が担うので、そこに実際に出たか
  // （back-link/AI 相関/同 eventName の対処済み）を collectPastIncidentRefs で突合し、
  // 検索でヒットしても節へ出ない＝引用なしなら他の証拠源と同じ規律でグレー格下げする。
  const pastRefCount = collectPastIncidentRefs(alert, corpus ?? []).length;
  const uncited = new Set(
    ledgerKeys.filter((key) => {
      if (key === "similarIncidents") {
        return (counts?.similarIncidents ?? 0) > 0 && pastRefCount === 0;
      }
      const kind = COUNT_KEY_TO_KIND[key];
      if (!kind) return false;
      const count = key === "security" ? securityCount : counts?.[key] ?? 0;
      return count > 0 && !sections.some((s) => s.kind === kind);
    }),
  );
  const scrollToSection = (key: EvidenceLedgerKey) => {
    const kind = COUNT_KEY_TO_KIND[key];
    const el = kind ? sectionRefs.current[kind] : undefined;
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches;
    el?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <section className={cn("space-y-3", className)} aria-label="収集した証拠">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-300">
        収集した証拠
      </h4>

      {phase === "error" ? (
        <div className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          証拠の取得に失敗しました。{error?.message}
        </div>
      ) : phase === "analyzing" ? (
        <div className="flex items-center gap-2 rounded-md bg-slate-800/40 px-3 py-3 text-xs text-slate-300">
          <span
            aria-hidden
            className="h-2 w-2 animate-pulse rounded-full bg-cyan-400"
          />
          AI が証拠を解析しています…
        </div>
      ) : (
        <div className="space-y-3">
          {counts ? (
            // 件数記録があれば台帳グリッドを要約として先頭に出す（C-3）。
            // 全カテゴリ 0 でもグレーの 0 が並ぶ画がそのまま「探した結果ゼロ」を語る
            // （長文の言い訳より正直で速い）。
            <EvidenceCountsGrid
              counts={counts}
              securityCount={securityCount}
              keys={ledgerKeys}
              navigable={navigable}
              uncited={uncited}
              onSelect={scrollToSection}
            />
          ) : (
            sections.length === 0 && (
              // 件数未記録の旧 Alert・fallback だけ従来の文フォールバック。
              <div className="space-y-1">
                <p className="text-xs text-slate-300">
                  原因の根拠として引用されたインフラ証拠（ログ・メトリクス・Terraform・コミット）はありませんでした。
                </p>
                <p className="text-xs text-slate-400">
                  根拠が関連アラートや過去の同型事例にある場合は、それぞれのセクションに表示されます。
                </p>
              </div>
            )
          )}
          {sections.map((section, i) => {
            // 前セクションまでの累積スロット数を基点に、行単位で連続 stagger させる。
            const baseIndex = sections
              .slice(0, i)
              .reduce((sum, s) => sum + sectionSlotCount(s), 0);
            return (
              <div
                key={section.kind}
                ref={(el) => {
                  sectionRefs.current[section.kind] = el;
                }}
                className="scroll-mt-2"
              >
                <EvidenceSectionView section={section} baseIndex={baseIndex} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
