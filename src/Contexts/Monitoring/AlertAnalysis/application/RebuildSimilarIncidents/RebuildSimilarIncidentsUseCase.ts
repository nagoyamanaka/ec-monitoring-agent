import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import {
  ResolvedIncident,
  SimilarIncidentRepository,
} from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { resolvedIncidentFromAlert } from "../../domain/resolvedIncidentFromAlert.js";

// 類似コーパス（SimilarIncident＝ES）を正本（Mongo の承認済み Alert）から作り直す管理コマンド。
// 承認時と同じ変換（resolvedIncidentFromAlert）で index し直すので、ES のデータが飛んでも
// 承認学習分は失われない＝「ES は作り直せる派生インデックス」を実体にする。
//
// 冪等性: sourceAlertId で先に撤回してから index する（承認は Alert 1件につき事例 1件の不変条件）。
// 何度打っても同じ状態に収束し、途中で失敗しても処理済み分は正しい形で残る（全消去はしない＝
// 読み取りに失敗した時点で空のコーパスになる clear 方式を避ける）。
// 撤回で消えた学習は Mongo 側でも feedback が承認でなくなっているので再構築でも復活しない。
export class RebuildSimilarIncidentsUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly similarIncidentRepository: SimilarIncidentRepository,
    private readonly logger: Logger,
    // コードが正本の固定事例（デモの seed）。Mongo 由来ではないのでここから入れ直す。
    // 派生の後に入れるので、同じ sourceAlertId を持つ Alert の派生は seed で上書きされる
    // （seed の searchText は手で調整した値＝派生で崩さない）。本番（seed 無し）は空でよい。
    private readonly seedIncidents: readonly ResolvedIncident[] = [],
  ) {}

  async run(): Promise<{ rebuilt: number; seeded: number }> {
    const approved = await this.alertRepository.findApproved();
    for (const alert of approved) {
      await this.similarIncidentRepository.removeByAlertId(alert.id.value);
      await this.similarIncidentRepository.index(resolvedIncidentFromAlert(alert));
    }

    for (const seed of this.seedIncidents) {
      // seed は sourceAlertId を持つ前提（ResolvedIncidentSeed）。それが冪等キーになる。
      if (seed.sourceAlertId !== undefined) {
        await this.similarIncidentRepository.removeByAlertId(seed.sourceAlertId);
      }
      await this.similarIncidentRepository.index(seed);
    }

    await this.logger.info({
      service: "backoffice-backend",
      action: "similar_incidents_rebuilt",
      message: `類似コーパスを正本から再構築：承認済み ${approved.length}件, seed ${this.seedIncidents.length}件`,
    });
    return { rebuilt: approved.length, seeded: this.seedIncidents.length };
  }
}
