import type {
  InvestigationStepView,
  InvestigationLinkKind,
} from "../../domain/InvestigationReportView";

// ディープリンク種別ごとのアイコン（log=Cloud Logging, code=GitHub, runbook=手順書, console=Cloud Console）。
const KIND_ICON: Record<InvestigationLinkKind, string> = {
  log: "📄",
  code: "🔧",
  runbook: "📘",
  console: "🖥️",
};

/**
 * 調査ステップ／推奨アクションの1項目。`href` があれば外部サービスへのディープリンク
 * （新規タブ・rel="noopener"・kind アイコン）、無ければプレーンテキスト。
 * 障害対応の動線として「どこを見るか」へ直接飛べるようにする。
 */
export function InvestigationItem({ item }: { item: InvestigationStepView }) {
  if (!item.href) return <>{item.text}</>;
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 transition hover:text-cyan-200 hover:decoration-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      {item.kind && <span aria-hidden>{KIND_ICON[item.kind]}</span>}
      <span>{item.text}</span>
      <span aria-hidden className="text-cyan-500/70">
        ↗
      </span>
    </a>
  );
}
