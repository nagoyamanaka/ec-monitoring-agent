import { Logger } from "../../../Shared/domain/logging/Logger.js";
import { GitHubGateway } from "../../AIInvestigation/infrastructure/infrainvestigation/GitHubGateway.js";
import { ForecastSignal, ForecastSignalKind } from "../domain/ForecastSignal.js";
import { ForecastSignalSource } from "../domain/ForecastSignalSource.js";
import { normalizeSubject } from "../domain/forecastSubject.js";

// GitHub open PR（未マージ＝FUTURE_CHANGE）を ForecastSignal に正規化する。
// subject はタイトル由来（和文等で潰れたらブランチ名にフォールバック）＝ForecastMemory の
// トークン照合（forecastSubject）に載る。正規化を Source 内に閉じ、Handler は配列を回すだけ。
export class PullRequestSignalSource implements ForecastSignalSource {
  constructor(
    private readonly gitHubGateway: GitHubGateway,
    private readonly logger: Logger,
  ) {}

  async collect(_horizon: string): Promise<ForecastSignal[]> {
    try {
      const pullRequests = await this.gitHubGateway.listOpenPullRequests();
      return pullRequests.map((pr) => ({
        id: `pr-${pr.number}`,
        kind: ForecastSignalKind.FUTURE_CHANGE,
        subject:
          normalizeSubject(pr.title) || normalizeSubject(pr.headRef) || "github_pr",
        when: "未マージ（merge され次第有効）",
        desc: pr.draft ? `[draft] ${pr.title}` : pr.title,
        source: `github.pr#${pr.number}`,
        ...(pr.url ? { url: pr.url } : {}),
      }));
    } catch (error) {
      // 予兆はベストエフォート＝1源の失敗で予報全体を落とさない（他シグナルで縮退継続）。
      await this.logger.warn({
        service: "backoffice-backend",
        action: "forecast_signal_collect_failed",
        message: `open PR シグナル収集に失敗しました（スキップ）：${(error as Error).message}`,
      });
      return [];
    }
  }
}
