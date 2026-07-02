import { useState } from "react";

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

const STEPS = [
  {
    title: "① 障害を注入",
    body: "右のデモ操作卓からシナリオを選んで実行します。",
  },
  {
    title: "② AI の調査を見る",
    body: "既知の障害は1秒未満で確定、未知はAIエージェントが証拠を集めて原因を推定します。",
  },
  {
    title: "③ 承認で学習",
    body: "レポートを承認すると既知パターンに昇格し、次回から即時判定になります。",
  },
] as const;

/**
 * 審査員ファーストラン向けの3ステップガイド（初回訪問のみ・dismissible）。
 * デプロイURLを開いた初見の人に「まず何をすれば体験できるか」を示す。
 * 閉じたら localStorage に記録して以後は描画しない。
 */
export function FirstRunGuide() {
  const [dismissed, setDismissed] = useState(readDismissed);
  if (dismissed) return null;

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <section
      aria-label="はじめてのガイド"
      className="w-full max-w-4xl rounded-tremor-default bg-cyan-500/10 px-4 py-3 ring-1 ring-inset ring-cyan-500/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-cyan-200">
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
            className="rounded-md bg-slate-900/40 px-3 py-2 ring-1 ring-inset ring-slate-700/50"
          >
            <div className="font-semibold text-slate-100">{step.title}</div>
            <div className="mt-0.5 leading-relaxed text-slate-300">
              {step.body}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
