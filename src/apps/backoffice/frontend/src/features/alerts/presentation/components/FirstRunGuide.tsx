import { useCallback, useState } from "react";

/** 一度閉じたら再表示しないための localStorage キー。 */
const DISMISS_KEY = "ec-monitoring-agent:first-run-guide:dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // private mode 等で localStorage が使えない環境では毎回表示に倒す
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // 保存できなくても閉じる操作自体は成立させる（このセッション中は出さない）
  }
}

// 各ステップは「何をすれば体験できるか」の行動手順に徹する。
// 価値の主張（1秒未満・証拠つき等）は常設ヘッダ（AlertsHeader）に一本化し、
// ここでは反復しない。③ の「即時判定」だけは主張の再掲でなく確認方法として残す。
//
// ②③（調査ライブ・承認学習）が起きるのは操作卓の「未知 ・ AI が調査」群だけなので、
// ① はその群に固定してレシピ化する（ガイド通りの操作で必ず②③が再現する）。
// 既知・類似の群が①だけで終わるのは欠陥でなく「学習後の世界」のプレビュー＝注記1行で明示。
const STEPS = [
  {
    title: "① 未知の障害を注入",
    body: "右の操作卓「未知 ・ AI が調査」の群からシナリオを実行します。",
  },
  {
    title: "② AI の調査を見る",
    body: "証拠の収集から原因の推定までがライブで流れます。",
  },
  {
    title: "③ 承認して、もう一度注入",
    body: "同じ障害が今度は即時判定に変わるのを確認できます。",
  },
] as const;

/**
 * ガイドの可視状態（localStorage 永続）をページ側でも使えるように切り出したフック。
 * ファーストビューはガイドと常設ヘッダで価値説明が重複するため、ページが
 * 「ガイド表示中はヘッダの価値段落を出さない」判断に使う（say it once）。
 */
export function useFirstRunGuide(): { visible: boolean; dismiss: () => void } {
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);
  return { visible: !dismissed, dismiss };
}

export interface FirstRunGuideProps {
  /** 省略時は自己管理（従来挙動）。ページで可視状態を共有するときは useFirstRunGuide を渡す。 */
  visible?: boolean;
  onDismiss?: () => void;
}

/**
 * 審査員ファーストラン向けの3ステップガイド（初回訪問のみ・dismissible）。
 * デプロイURLを開いた初見の人に「まず何をすれば体験できるか」を示す。
 * 閉じたら localStorage に記録して以後は描画しない。
 */
export function FirstRunGuide({ visible, onDismiss }: FirstRunGuideProps = {}) {
  const own = useFirstRunGuide();
  const shown = visible ?? own.visible;
  const dismiss = onDismiss ?? own.dismiss;
  if (!shown) return null;

  return (
    <section
      aria-label="はじめてのガイド"
      className="w-full max-w-4xl rounded-tremor-default bg-cyan-500/10 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-cyan-200">
          3ステップで学習ループを体験できます
        </h2>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs text-cyan-300/80 ring-1 ring-inset ring-cyan-500/30 hover:bg-cyan-500/15 hover:text-cyan-200"
        >
          閉じる
        </button>
      </div>
      <ol className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className="rounded-md bg-slate-900/40 px-3 py-2"
          >
            <div className="font-medium text-slate-100">{step.title}</div>
            <div className="mt-0.5 leading-relaxed text-slate-300">
              {step.body}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        ※「既知」「類似」の群は、この学習を終えた後の世界 —
        注入だけで即時判定される姿を最初から体験できます。
      </p>
    </section>
  );
}
