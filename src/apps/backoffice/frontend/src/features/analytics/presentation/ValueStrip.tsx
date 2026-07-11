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
 * 件数は seed の過去解決事例（類似判定の学習履歴の種）を含む累計のため、リセット直後でも
 * 0 にならない。空一覧との軸不一致に見えないよう「過去実績含む」を明示する（RESOLVED 除外は
 * Analytics ページ・昇格ファネルと同じ集計を共有しており、ここだけ意味を変えないため不採用）。
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

  // 等式レイアウト: 総アラート N 件 ＝ 既知即決 a ＋ AI調査 b ｜ 学習パターン化 c
  // 総数と内訳の親子関係を「＝」「＋」で構造ごと見せる（4+6=10 が自己検証でき、
  // ラベルの意味を説明しなくても数字の正体＝アラート件数の内訳だと読める）。
  // 親は「自動対応」等の処理結果でなく入口の総数（Analytics ページのタイルと同語）:
  // AI調査は人の承認待ちを含むため「対応済み」に足し込むと過大主張になる。
  const terms = [
    { label: "既知即決", value: analytics.knownCount },
    { label: "AI調査", value: analytics.unknownCount },
  ];

  // 学習ループの成果表示: 昇格ゲート未通過で 0 のとき「学習パターン化 0」と出すと
  // 「学習が動いていない」と読み違えられる（実際は承認済み知識が昇格待ち）。
  // 0 時は前向き語彙「承認済み N・昇格待ち」へ切替え、承認済みも 0 なら項目ごと出さない
  // （analytics 側の学習の軌跡ヒーローが物語を担うため欠けても成立する）。
  const promoted = analytics.promotedPatternCount;
  const approvedCount = analytics.approvedAlerts.length;
  const learning =
    promoted > 0
      ? { label: "学習パターン化", value: promoted, note: null }
      : approvedCount > 0
        ? { label: "承認済み", value: approvedCount, note: "昇格待ち" }
        : null;

  return (
    <button
      type="button"
      onClick={() => navigate("/analytics")}
      title="クリックで Analytics（内訳・正答率・承認履歴）へ。件数は過去の解決実績（学習済み履歴）を含む累計です"
      className="flex w-full max-w-4xl flex-wrap items-center gap-x-2.5 gap-y-1 rounded-tremor-default bg-slate-800/30 px-4 py-2 text-left text-xs ring-1 ring-inset ring-slate-700/50 transition hover:bg-slate-800/50"
    >
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-slate-400">総アラート</span>
        <span className="text-sm font-semibold tabular-nums text-slate-100">
          {analytics.totalAlerts}
        </span>
        <span className="text-slate-400">件</span>
      </span>
      {terms.map((term, i) => (
        <span key={term.label} className="inline-flex items-baseline gap-2.5">
          {/* 等式の演算子は読めて初めて等式＝装飾でなく本文（プロジェクター可読の下限 slate-400）。 */}
          <span className="text-slate-400" aria-hidden>
            {i === 0 ? "＝" : "＋"}
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-slate-400">{term.label}</span>
            <span className="text-sm font-semibold tabular-nums text-slate-100">
              {term.value}
            </span>
          </span>
        </span>
      ))}
      {learning && (
        <>
          <span className="text-slate-600" aria-hidden>
            ｜
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-slate-400">{learning.label}</span>
            <span className="text-sm font-semibold tabular-nums text-slate-100">
              {learning.value}
            </span>
            {learning.note && (
              <span className="text-slate-400">・{learning.note}</span>
            )}
          </span>
        </>
      )}
      <span className="text-xs text-slate-400">※過去実績含む</span>
      <span className="ml-auto text-cyan-300/80" aria-hidden>
        Learning →
      </span>
    </button>
  );
}
