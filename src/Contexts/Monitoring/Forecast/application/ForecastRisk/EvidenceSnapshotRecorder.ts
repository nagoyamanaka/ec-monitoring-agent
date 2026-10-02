import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import {
  EvidenceSnapshotRepository,
  captureEvidenceSnapshot,
} from "../../domain/EvidenceSnapshot.js";
import { ForecastContext } from "../../domain/ForecastContext.js";

/**
 * 予報器を呼ぶ直前に、その入力を証拠スナップショットとして凍結する（T0-2）。
 * 台帳と同じく記録であって予報の出し方ではないので、保存の失敗で予報を止めない。
 * 失敗した回は空文字を返す＝台帳に「保存されていない id」を書かない（存在しない入力を指さない）。
 */
export class EvidenceSnapshotRecorder {
  constructor(
    private readonly snapshots: EvidenceSnapshotRepository,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async capture(context: ForecastContext): Promise<string> {
    const snapshot = captureEvidenceSnapshot(context, this.now());
    try {
      await this.snapshots.save(snapshot);
      return snapshot.snapshotId;
    } catch (error) {
      await this.logger.error({
        service: "backoffice-backend",
        action: "evidence_snapshot_save_failed",
        message: `証拠スナップショットの保存に失敗しました（台帳の evidenceSnapshotId は空になります）: snapshotId=${snapshot.snapshotId}, signals=${context.signals.length}, error=${error instanceof Error ? error.message : String(error)}`,
      });
      return "";
    }
  }
}
