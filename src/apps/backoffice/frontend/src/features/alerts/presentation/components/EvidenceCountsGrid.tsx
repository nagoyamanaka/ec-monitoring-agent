import { cn } from "@shared/ui/cn";
import type { InvestigationMetricsView } from "../../domain/InvestigationReportView";
import type { EvidenceLedgerKey } from "../../domain/evidenceLedger";
import { EVIDENCE_SOURCE_ICONS } from "./evidenceSourceIcons";

/**
 * 証拠カウントの台帳グリッド（タスク C-3）。
 * 「AI が探した結果ゼロだった」は情報なので、0 件のカテゴリも隠さずグレーで出す
 * （確信度が低い理由＝裏付けの少なさをグリッドから直感できるようにする）。
 * 表示セルは evidenceLedgerKeys（category オーナーシップ）で調査対象の証拠源に絞る＝
 * 台帳の 0 は常に「調べたが該当なし」を意味し、調べていない源を 0 と偽らない。
 * 件数は backend 記録の実測（InvestigationMetrics.evidenceCounts）＝盛る経路が無い。
 * security（Trivy CVE）だけは検知イベント payload 由来の実測（securityCount）。
 * アイコン・呼称は evidenceFlow / EvidencePanel の SOURCE_META と揃える。
 * グリッドは「件数の台帳」・実物は直下のセクションが担う＝ >0 のセルはクリックで
 * 該当セクションへスクロールし、台帳と実物の対応を指で確認できるようにする。
 */
export type EvidenceCountKey = keyof InvestigationMetricsView["evidenceCounts"];

export interface EvidenceCountsGridProps {
  counts: InvestigationMetricsView["evidenceCounts"];
  /** Trivy（CI スキャン）の実測件数。keys に "security" を含めた時だけ使われる。 */
  securityCount?: number;
  /** 表示するセルとその順序（evidenceLedgerKeys の結果）。省略時は調査5キー全部。 */
  keys?: ReadonlyArray<EvidenceLedgerKey>;
  /**
   * セル選択（>0 かつ遷移先セクションが実在するキーのみ呼ばれる）。
   * 遷移可能なキー集合は navigable で渡す（過去事例は本パネル外＝通常含めない）。
   */
  onSelect?: (key: EvidenceLedgerKey) => void;
  navigable?: ReadonlySet<EvidenceLedgerKey>;
  /**
   * 収集したが AI が原因へ引用しなかった証拠源（実物セクションが直下に無い）。
   * cyan は「下で実物を確認できる裏付け」に予約し、これらはグレーに格下げ＋但し書きで
   * 「調査の広さの実測であって結論の裏付けではない」ことを明示する。
   */
  uncited?: ReadonlySet<EvidenceLedgerKey>;
  className?: string;
}

const CELLS: ReadonlyArray<{
  key: EvidenceLedgerKey;
  label: string;
  source: string;
}> = [
  { key: "security", label: "スキャン", source: "Trivy (CI スキャン)" },
  { key: "logs", label: "ログ", source: "Cloud Logging" },
  { key: "metrics", label: "メトリクス", source: "Cloud Monitoring" },
  { key: "terraformChanges", label: "Terraform", source: "Terraform 適用差分" },
  { key: "commits", label: "コミット", source: "GitHub" },
  { key: "similarIncidents", label: "過去事例", source: "類似事例DB" },
];

const DEFAULT_KEYS: ReadonlyArray<EvidenceLedgerKey> = [
  "logs",
  "metrics",
  "terraformChanges",
  "commits",
  "similarIncidents",
];

/** 過去事例の実物は本パネル外（過去の同型事例セクション）が担うため tooltip で案内する。 */
const CELL_NOTE: Partial<Record<EvidenceLedgerKey, string>> = {
  similarIncidents: "（実物は「過去の同型事例」セクションに表示）",
};

/** Tailwind は動的クラス名を拾えないため列数→クラスの静的対応表を持つ。 */
const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

export function EvidenceCountsGrid({
  counts,
  securityCount,
  keys = DEFAULT_KEYS,
  onSelect,
  navigable,
  uncited,
  className,
}: EvidenceCountsGridProps) {
  const cells = CELLS.filter((cell) => keys.includes(cell.key));
  const countOf = (key: EvidenceLedgerKey): number =>
    key === "security" ? securityCount ?? 0 : counts[key];
  const hasZero = cells.some((cell) => countOf(cell.key) === 0);
  const hasUncited = cells.some(
    (cell) => countOf(cell.key) > 0 && !!uncited?.has(cell.key),
  );
  return (
    <div className={cn("space-y-1.5", className)}>
      <ul className={cn("grid gap-1.5", GRID_COLS[cells.length] ?? "grid-cols-5")}>
        {cells.map((cell) => {
          const CellIcon = EVIDENCE_SOURCE_ICONS[cell.key];
          const count = countOf(cell.key);
          const empty = count === 0;
          const isUncited = !empty && !!uncited?.has(cell.key);
          const clickable =
            !empty && !isUncited && !!onSelect && !!navigable?.has(cell.key);
          const title = empty
            ? `${cell.source}: 調査済み・該当証拠なし`
            : isUncited
              ? `${cell.source}: ${count}件収集・原因への引用なし（無関係な証拠は列挙しない）`
              : `${cell.source}: ${count}件${
                  clickable ? "（クリックで該当証拠へ）" : CELL_NOTE[cell.key] ?? ""
                }`;
          const body = (
            <>
              {/* ドロワー幅（1セル約80px）でも「メトリクス」が折り返さない詰め幅。 */}
              <p
                className={cn(
                  "flex items-center justify-center gap-0.5 whitespace-nowrap text-[11px] tracking-tight",
                  empty ? "text-slate-600" : "text-slate-400",
                )}
              >
                <CellIcon
                  className={cn(
                    "shrink-0",
                    !empty && (isUncited ? "text-slate-400" : "text-cyan-300"),
                  )}
                />
                {cell.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-lg font-semibold tabular-nums leading-none",
                  empty
                    ? "text-slate-600"
                    : isUncited
                      ? "text-slate-400"
                      : "text-cyan-300",
                  // クリックできるセルは数字に点線下線＝本アプリのリンク語彙（CVE/sha と同じ）を
                  // 静止画でも見えるアフォーダンスとして載せる。
                  clickable &&
                    "underline decoration-dotted decoration-cyan-400/60 underline-offset-4",
                )}
              >
                {count}
              </p>
            </>
          );
          return (
            <li key={cell.key} className={cn(empty && "text-slate-600")}>
              {clickable ? (
                <button
                  type="button"
                  title={title}
                  onClick={() => onSelect(cell.key)}
                  className="w-full rounded-md bg-slate-800/40 px-1 py-2 text-center transition hover:bg-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {body}
                </button>
              ) : (
                <div
                  title={title}
                  className="rounded-md bg-slate-800/40 px-1 py-2 text-center"
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hasZero && (
        <p className="text-xs text-slate-400">
          0 のカテゴリも調査済み（該当証拠なし）
        </p>
      )}
      {hasUncited && (
        <p className="text-xs text-slate-400">
          収集しても原因に引用しなかった証拠は表示しません
        </p>
      )}
    </div>
  );
}
