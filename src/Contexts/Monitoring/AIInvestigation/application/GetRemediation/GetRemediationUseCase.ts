import { RemediationRepository } from "../../domain/remediation/RemediationRepository.js";
import { RemediationResponse } from "./RemediationResponse.js";

// アラート別のリメディエーション状態（PR URL・状態）を read-only で返す。
// 未起票でも 404 ではなく status="none" を返し、フロントのポーリング/ボタン制御を単純化する。
export class GetRemediationUseCase {
  constructor(private readonly remediationRepository: RemediationRepository) {}

  async run(alertId: string): Promise<RemediationResponse> {
    const record = await this.remediationRepository.findByAlertId(alertId);
    return new RemediationResponse(alertId, record);
  }
}
