import { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyStateFigure } from "./EmptyStateFigure";

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * ルート直下に1枚被せる保険（step9 N1）。子ツリーの throw（null フィールド・想定外データ・
 * 壊れた SSE payload など）を捕捉し、React による**全画面アンマウント＝真っ白**を、この画面
 * だけの局所フォールバック板へ劣化させる。ライブデモ／録画中の白画面（復旧にリロード操作が
 * 要る＝流れが死ぬ）を防ぐのが唯一の目的で、加点ではなく事故の下限を上げるための備え。
 * class component でしか componentDidCatch を実装できないため、この1個だけ class で書く。
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 画面は劣化させるが、原因はコンソールに残す（デモ後の調査の手掛かり）。
    console.error("ErrorBoundary caught", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0B0E14] px-6 text-center text-tremor-content-emphasis"
      >
        {/* disabled バリアント＝無彩の中空リング（cyan は予測にだけ使うので流用しない）。 */}
        <EmptyStateFigure variant="disabled" className="text-slate-500" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-200">
            この画面の表示に失敗しました
          </p>
          <p className="text-[13px] text-slate-400">
            再読み込みすると復帰します。
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-md bg-slate-700/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700/70"
        >
          再読み込み
        </button>
      </div>
    );
  }
}
