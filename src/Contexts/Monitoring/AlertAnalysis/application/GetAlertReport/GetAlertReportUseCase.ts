import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { AlertResponse } from "../AlertResponse.js";

export class GetAlertReportUseCase {
  constructor(private readonly alertRepository: AlertRepository) {}

  async run(): Promise<AlertResponse> {
    const alerts = await this.alertRepository.findByCriteria(Criteria.none());
    // RESOLVED（解決済みアーカイブ＝過去アラートの seed 等）は一覧に出さない。
    // 関連アラート導線・ディープリンク（GET /alerts/:id）からは引けるので、
    // 「一覧を汚さず、過去アラートは関連として辿れる」を両立する。
    const active = alerts.filter((alert) => alert.status.value !== "RESOLVED");
    return new AlertResponse(active);
  }
}
