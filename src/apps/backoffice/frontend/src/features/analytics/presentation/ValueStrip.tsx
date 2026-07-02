import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AnalyticsApi } from "../infrastructure/analyticsApi";
import type { AnalyticsView } from "../domain/AnalyticsView";

export interface ValueStripProps {
  api: AnalyticsApi;
  /**
   * 変わるたびに再取得するキー（一覧の lastUpdatedAt など）。
   * デモを触るほど数字が増える＝価値の蓄積をライブで見せる。
   */
  refreshKey?: number | null;
}

/**
 * 一覧上部の実績ストリップ（G2）。「この製品が何をどれだけ肩代わりしたか」を
 * Analytics の実データ（システムが実際に記録した事実）だけで語る。
 * 換算値（人間なら◯分等）は根拠を出せないため表示しない（正直さの制約）。
 * クリックで Analytics ページ（内訳・正答率・承認履歴）へ。
 * 取得失敗時は何も出さない（一覧の主機能を阻害しない enhancement）。
 */
export function ValueStrip({ api, refreshKey }: ValueStripProps) {
  const [analytics, setAnalytics] = useState<AnalyticsView | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    api
      .getAnalytics(controller.signal)
      .then(setAnalytics)
      .catch(() => {
        /* 表示しないだけ（初回 500 等でも一覧を邪魔しない） */
      });
    return () => controller.abort();
  }, [api, refreshKey]);

  if (!analytics) return null;

  const items = [
    { label: "自動トリアージ", value: analytics.totalAlerts },
    { label: "既知即決", value: analytics.knownCount },
    { label: "AI 調査", value: analytics.unknownCount },
    { label: "昇格パターン", value: analytics.promotedPatternCount },
  ];

  return (
    <button
      type="button"
      onClick={() => navigate("/analytics")}
      title="クリックで Analytics（内訳・正答率・承認履歴）へ"
      className="flex w-full max-w-4xl flex-wrap items-center gap-x-5 gap-y-1 rounded-tremor-default bg-slate-800/30 px-4 py-2 text-left text-xs ring-1 ring-inset ring-slate-700/50 transition hover:bg-slate-800/50 hover:ring-slate-600"
    >
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-baseline gap-1.5">
          <span className="text-slate-400">{item.label}</span>
          <span className="text-sm font-semibold tabular-nums text-slate-100">
            {item.value}
          </span>
          <span className="text-slate-400">件</span>
        </span>
      ))}
      <span className="ml-auto text-cyan-300/80" aria-hidden>
        Analytics →
      </span>
    </button>
  );
}
