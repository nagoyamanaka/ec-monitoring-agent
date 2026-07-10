import { Link } from "react-router-dom";

/** 反応的パイプラインの段名（FirstRunGuide／デモ台本 D1 と同じ語彙＝新規概念を増やさない）。 */
const PIPELINE_STEPS = ["検知", "分類", "AI調査", "承認・学習"] as const;

/**
 * 予兆 → 反応的パイプラインの橋渡しCTA（step6 F10-②・F11b で保険へ降格）。
 * 予兆の主役は「発火前に握りつぶす」＝各 RiskCard の先手（F11a）であり、本CTAは
 * 「先手を打てないまま発火した場合でも受け皿がある」ことを示す**保険**の位置づけ。
 * 見出し・サイズ・明度を先手ブロックより一段落として視覚的に従属させる。
 * ページ単位で1個（per-risk にしない＝未発火リスクに対応する具体 alert がまだ無く
 * リンク先を作れない）。破線ボーダーは「まだ発火していない未来」の視覚表現＝実線の
 * RiskCard（実在照合済みの根拠）と区別する。実行ボタンにはしない（write-zero 維持）。
 */
export function ForecastBridgeCta() {
  return (
    <aside
      aria-label="反応的パイプラインへの案内"
      className="space-y-2 rounded-lg bg-slate-800/30 p-4"
    >
      <h3 className="text-xs font-medium text-slate-300">
        もし防ぎきれずに発火したら？
      </h3>
      <p className="max-w-prose text-xs leading-relaxed text-slate-400">
        先手を打てないまま予兆が現実になっても、同じ証拠ソース（GitHub・Terraform・過去事例）を
        横断する反応的パイプラインが検知から承認までを引き継ぎます。
      </p>
      <div
        className="flex flex-wrap items-center gap-1.5 text-[11px]"
        aria-hidden
      >
        {PIPELINE_STEPS.map((step, i) => (
          <span key={step} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-600">→</span>}
            <span className="rounded-full bg-slate-800/60 px-2 py-0.5 font-medium text-slate-400">
              {step}
            </span>
          </span>
        ))}
      </div>
      <Link
        to="/alerts"
        className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-cyan-400/80 transition hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        アラート一覧を見る
        <span aria-hidden>→</span>
      </Link>
    </aside>
  );
}
