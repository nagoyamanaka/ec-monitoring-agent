import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertRepository } from "../../../AlertAnalysis/domain/AlertRepository.js";
import { MonitoringResourceNotFoundError } from "../../../AlertAnalysis/application/errors/MonitoringResourceNotFoundError.js";
import { InfraInvestigationPort } from "../../domain/InfraInvestigationPort.js";
import { InfraEvidenceResponse } from "./InfraEvidenceResponse.js";
import { restrictEvidenceToCitedCommits } from "./CitedCommitFilter.js";

// アラート起因のインフラ証拠（アプリログ／Terraform差分／直近コミット）を read-only で取得する。
// 証拠は調査時にも収集するが永続化していないため、表示要求時に再収集する（全 Gateway は read-only）。
export class GetInfraEvidenceUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly infraInvestigationPort: InfraInvestigationPort,
    private readonly logger: Logger,
  ) {}

  async run(id: AlertId): Promise<InfraEvidenceResponse> {
    const alert = await this.alertRepository.findById(id);

    if (!alert) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "get_infra_evidence_not_found",
        message: `アラート未存在：${id.value}`,
      });
      throw new MonitoringResourceNotFoundError("Alert", id.value);
    }

    const evidence = await this.infraInvestigationPort.collect(
      alert.monitoringEvent,
    );
    // 直近コミットは収集時点では category 駆動で無条件に積まれている。原因でない証拠は出さない
    // 方針に合わせ、AI 調査が引用したコミットだけに絞ってから返す（報告書が無ければコミットは落ちる）。
    const relevant = restrictEvidenceToCitedCommits(
      evidence,
      alert.investigationReport,
    );
    return new InfraEvidenceResponse(relevant);
  }
}
